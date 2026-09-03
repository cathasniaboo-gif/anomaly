import { Router } from 'express';
import crypto from 'crypto';
import { requireAdmin } from '../auth';
import { ah } from '../asyncHandler';
import { ledgersCollection, connectionsCollection, oauthStatesCollection } from './db';
import { runScrutiny, RULES } from './scrutiny';
import { parseCsvLedger } from './importers/csv';
import { getConnector, connectors } from './connectors';
import { LedgerRecord, toLedgerListItem } from './types';

const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

function buildLedgerRecord(name: string, source: LedgerRecord['source'], entries: LedgerRecord['entries']): LedgerRecord {
  const { findings, summary } = runScrutiny(entries);
  return {
    id: `ldg-${crypto.randomUUID()}`,
    name,
    source,
    importedAt: new Date().toISOString(),
    entries,
    findings,
    summary,
  };
}

export function auditRouter(): Router {
  const router = Router();

  // --- Rule catalogue -----------------------------------------------------

  router.get('/rules', requireAdmin, (_req, res) => {
    res.json(RULES);
  });

  // --- Ledgers: manual import + scrutiny results --------------------------

  router.post('/ledgers/import', requireAdmin, ah(async (req, res) => {
    const { name, csv } = req.body ?? {};
    if (typeof csv !== 'string' || !csv.trim()) {
      res.status(400).json({ error: 'csv (string) is required' });
      return;
    }
    const { entries, errors } = parseCsvLedger(csv);
    if (errors.length) {
      res.status(400).json({ errors });
      return;
    }
    const record = buildLedgerRecord(typeof name === 'string' && name.trim() ? name.trim() : 'Imported ledger', 'import', entries);
    await ledgersCollection.insert(record);
    res.status(201).json(record);
  }));

  router.get('/ledgers', requireAdmin, (_req, res) => {
    const items = ledgersCollection.all().map(toLedgerListItem);
    items.sort((a, b) => (a.importedAt < b.importedAt ? 1 : -1));
    res.json(items);
  });

  router.get('/ledgers/:id', requireAdmin, (req, res) => {
    const record = ledgersCollection.find((l) => l.id === req.params.id);
    if (!record) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(record);
  });

  router.post('/ledgers/:id/rescan', requireAdmin, ah(async (req, res) => {
    const record = ledgersCollection.find((l) => l.id === req.params.id);
    if (!record) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const { findings, summary } = runScrutiny(record.entries);
    const updated = await ledgersCollection.update((l) => l.id === record.id, { findings, summary });
    res.json(updated);
  }));

  router.delete('/ledgers/:id', requireAdmin, ah(async (req, res) => {
    const removed = await ledgersCollection.remove((l) => l.id === req.params.id);
    res.status(removed ? 204 : 404).end();
  }));

  // --- Accounting software connectors --------------------------------------

  router.get('/connectors', requireAdmin, (_req, res) => {
    const list = Object.values(connectors).map((c) => {
      const connection = connectionsCollection.find((x) => x.connectorId === c.id);
      return {
        id: c.id,
        name: c.name,
        configured: c.isConfigured(),
        connected: Boolean(connection),
        companyName: connection?.companyName ?? null,
        connectedAt: connection?.connectedAt ?? null,
      };
    });
    res.json(list);
  });

  router.get('/connectors/:id/auth-url', requireAdmin, ah(async (req, res) => {
    const connector = getConnector(req.params.id);
    if (!connector) {
      res.status(404).json({ error: 'Unknown connector' });
      return;
    }
    if (!connector.isConfigured()) {
      res.status(400).json({ error: `${connector.name} is not configured on this server (missing client id/secret/redirect URI env vars).` });
      return;
    }
    const state = crypto.randomUUID();
    await oauthStatesCollection.insert({ state, connectorId: connector.id, createdAt: new Date().toISOString() });
    res.json({ url: connector.buildAuthUrl(state) });
  }));

  // Reached by the accounting provider's browser redirect, not the app —
  // it can't carry an x-admin-key header, so a single-use `state` token
  // (minted by auth-url above and checked here) is what proves this
  // request is legitimate instead.
  router.get('/connectors/:id/callback', ah(async (req, res) => {
    const connector = getConnector(req.params.id);
    const { code, state, realmId } = req.query as Record<string, string | undefined>;
    const sendHtml = (title: string, body: string) => {
      res.status(200).type('html').send(`<!doctype html><html><head><title>${title}</title></head><body style="font-family:sans-serif;padding:2rem;"><h2>${title}</h2><p>${body}</p></body></html>`);
    };

    if (!connector) {
      sendHtml('Unknown connector', 'This audit app does not recognise this connector.');
      return;
    }
    const stateRecord = state ? oauthStatesCollection.find((s) => s.state === state && s.connectorId === connector.id) : undefined;
    // Single-use: remove immediately so a replayed callback can't reuse it,
    // regardless of whether the exchange below succeeds.
    if (stateRecord) await oauthStatesCollection.remove((s) => s.state === state);

    if (!stateRecord || Date.now() - new Date(stateRecord.createdAt).getTime() > OAUTH_STATE_TTL_MS) {
      sendHtml('Link expired', 'This connection link is invalid or has expired. Go back to the app and try connecting again.');
      return;
    }
    if (!code) {
      sendHtml('Connection cancelled', `${connector.name} did not return an authorization code.`);
      return;
    }

    try {
      const tokens = await connector.exchangeCode(code, realmId);
      const now = new Date().toISOString();
      await connectionsCollection.upsert(
        (c) => c.connectorId === connector.id,
        {
          connectorId: connector.id,
          realmId: tokens.realmId,
          companyName: tokens.companyName,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          connectedAt: now,
        }
      );
      sendHtml('Connected', `${connector.name}${tokens.companyName ? ` (${tokens.companyName})` : ''} is now connected. You can close this window and return to the app.`);
    } catch (err) {
      sendHtml('Connection failed', `Could not complete the ${connector.name} connection: ${err instanceof Error ? err.message : 'unknown error'}.`);
    }
  }));

  router.post('/connectors/:id/sync', requireAdmin, ah(async (req, res) => {
    const connector = getConnector(req.params.id);
    if (!connector) {
      res.status(404).json({ error: 'Unknown connector' });
      return;
    }
    let connection = connectionsCollection.find((c) => c.connectorId === connector.id);
    if (!connection) {
      res.status(400).json({ error: `${connector.name} is not connected yet.` });
      return;
    }
    if (new Date(connection.expiresAt).getTime() < Date.now() + 60_000) {
      const refreshed = await connector.refresh(connection.refreshToken, connection.realmId);
      connection = await connectionsCollection.update((c) => c.connectorId === connector.id, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.expiresAt,
      });
    }
    const entries = await connector.fetchLedgerEntries(connection!.accessToken, connection!.realmId);
    const record = buildLedgerRecord(
      `${connector.name}${connection!.companyName ? ` — ${connection!.companyName}` : ''} sync`,
      connector.id,
      entries
    );
    await ledgersCollection.insert(record);
    res.status(201).json(record);
  }));

  router.delete('/connectors/:id', requireAdmin, ah(async (req, res) => {
    const removed = await connectionsCollection.remove((c) => c.connectorId === req.params.id);
    res.status(removed ? 204 : 404).end();
  }));

  return router;
}
