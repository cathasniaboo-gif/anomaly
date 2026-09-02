import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { updatesCollection, scrapeRunsCollection } from './db';
import { requireAdmin } from './auth';
import { registerDevice, unregisterDevice, notifyDevicesOfUpdate } from './push';
import { toPublicUpdate, UpdateRecord, Category, UpdateAuthority, UpdateKind } from './types';
import { runAllScrapers } from './scraper/run';
import { ah } from './asyncHandler';

const AUTHORITIES: UpdateAuthority[] = ['FTA', 'MoF', 'IASB/ISSB', 'MOHRE', 'ICP/GDRFA', 'Other'];
const KINDS: UpdateKind[] = ['Guideline', 'Public Clarification', 'Decision', 'Notification'];

export function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  // --- Public: what the mobile app reads --------------------------------

  app.get('/api/updates', (req, res) => {
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;
    let items = updatesCollection.filter((u) => u.status === 'published');
    if (since) {
      items = items.filter((u) => u.updatedAt > since);
    }
    items.sort((a, b) => (a.date < b.date ? 1 : -1));
    res.json(items.map(toPublicUpdate));
  });

  app.get('/api/updates/:id', (req, res) => {
    const item = updatesCollection.find((u) => u.id === req.params.id && u.status === 'published');
    if (!item) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(toPublicUpdate(item));
  });

  app.post('/api/devices/register', ah(async (req, res) => {
    const { token, platform } = req.body ?? {};
    if (typeof token !== 'string' || !token) {
      res.status(400).json({ error: 'token is required' });
      return;
    }
    const validPlatform = ['ios', 'android', 'web', 'unknown'].includes(platform) ? platform : 'unknown';
    try {
      await registerDevice(token, validPlatform);
      res.status(204).end();
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid token' });
    }
  }));

  app.delete('/api/devices/:token', ah(async (req, res) => {
    await unregisterDevice(req.params.token);
    res.status(204).end();
  }));

  // --- Admin: review queue, manual curation, scraper control ------------

  app.get('/api/admin/updates', requireAdmin, (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const items = updatesCollection.filter((u) => !status || u.status === status);
    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json(items);
  });

  app.post('/api/admin/updates', requireAdmin, ah(async (req, res) => {
    const body = req.body ?? {};
    const status: 'pending' | 'published' = body.status === 'pending' ? 'pending' : 'published';
    // A pending (scraper-discovered or draft) entry only needs enough to
    // identify it; summary/detail are only mandatory once it's meant to be
    // published to end users.
    const errors = validateNewUpdate(body, status === 'published');
    if (errors.length) {
      res.status(400).json({ errors });
      return;
    }
    const now = new Date().toISOString();
    const record: UpdateRecord = {
      id: `upd-${crypto.randomUUID()}`,
      authority: body.authority,
      kind: body.kind,
      title: body.title,
      date: body.date,
      summary: body.summary ?? '',
      detail: body.detail ?? '',
      relatedCats: (body.relatedCats ?? []) as Category[],
      sourceLabel: body.sourceLabel,
      sourceUrl: body.sourceUrl,
      status,
      rawExcerpt: body.rawExcerpt ?? '',
      discoveredBy: 'manual',
      notified: false,
      createdAt: now,
      updatedAt: now,
    };
    await updatesCollection.insert(record);
    if (record.status === 'published') {
      const { sent, errors: pushErrors } = await notifyDevicesOfUpdate(record);
      await updatesCollection.update((u) => u.id === record.id, { notified: true });
      res.status(201).json({ record, push: { sent, errors: pushErrors } });
      return;
    }
    res.status(201).json({ record });
  }));

  app.patch('/api/admin/updates/:id', requireAdmin, ah(async (req, res) => {
    const existing = updatesCollection.find((u) => u.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const body = req.body ?? {};
    const patch: Partial<UpdateRecord> = { updatedAt: new Date().toISOString() };
    const editable: (keyof UpdateRecord)[] = [
      'authority', 'kind', 'title', 'date', 'summary', 'detail',
      'relatedCats', 'sourceLabel', 'sourceUrl', 'status',
    ];
    for (const key of editable) {
      if (body[key] !== undefined) (patch as any)[key] = body[key];
    }
    const wasPending = existing.status === 'pending';
    const nowPublished = (patch.status ?? existing.status) === 'published';

    if (nowPublished) {
      const validationErrors = validateNewUpdate({ ...existing, ...patch }, true);
      if (validationErrors.length) {
        res.status(400).json({ errors: validationErrors });
        return;
      }
    }

    const updated = await updatesCollection.update((u) => u.id === req.params.id, patch);
    if (!updated) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    let pushResult: { sent: number; errors: string[] } | null = null;
    if (wasPending && nowPublished && !updated.notified) {
      pushResult = await notifyDevicesOfUpdate(updated);
      await updatesCollection.update((u) => u.id === updated.id, { notified: true });
    }

    res.json({ record: updated, push: pushResult });
  }));

  app.delete('/api/admin/updates/:id', requireAdmin, ah(async (req, res) => {
    const removed = await updatesCollection.remove((u) => u.id === req.params.id);
    res.status(removed ? 204 : 404).end();
  }));

  app.post('/api/admin/scrape/run', requireAdmin, ah(async (_req, res) => {
    const results = await runAllScrapers();
    res.json({ results });
  }));

  app.get('/api/admin/scrape/runs', requireAdmin, (_req, res) => {
    const runs = scrapeRunsCollection.all();
    runs.sort((a, b) => (a.ranAt < b.ranAt ? 1 : -1));
    res.json(runs.slice(0, 50));
  });

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  // Must be registered last, and must take exactly 4 params for Express to
  // recognise it as an error handler. Without this, a rejected promise
  // from an ah()-wrapped route would otherwise hang the connection instead
  // of returning a response.
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error('[server] Unhandled error:', err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Internal server error' });
  };
  app.use(errorHandler);

  return app;
}

// `requireContent` gates summary/detail: a pending (draft/scraper-found)
// entry only needs enough to identify it, but nothing may transition to
// (or be created directly as) 'published' without a human-reviewed
// plain-English summary and detail.
function validateNewUpdate(body: any, requireContent: boolean): string[] {
  const errors: string[] = [];
  if (!AUTHORITIES.includes(body.authority)) errors.push(`authority must be one of ${AUTHORITIES.join(', ')}`);
  if (!KINDS.includes(body.kind)) errors.push(`kind must be one of ${KINDS.join(', ')}`);
  if (!body.title) errors.push('title is required');
  if (!body.date) errors.push('date is required');
  if (!body.sourceLabel) errors.push('sourceLabel is required');
  if (!body.sourceUrl) errors.push('sourceUrl is required');
  if (requireContent) {
    if (!body.summary) errors.push('summary is required (plain-English one-liner) before publishing');
    if (!body.detail) errors.push('detail is required before publishing');
  }
  return errors;
}
