import crypto from 'crypto';
import { fetchHtml } from './fetchHtml';
import { parseListing } from './parseListing';
import { SOURCES, ScrapeSource } from './sources';
import { updatesCollection, scrapeRunsCollection } from '../db';
import { UpdateRecord, UpdateKind, ScrapeRunResult } from '../types';

function inferKind(title: string, fallback: UpdateKind): UpdateKind {
  const t = title.toLowerCase();
  if (t.includes('clarification')) return 'Public Clarification';
  if (t.includes('decision') || t.includes('decree')) return 'Decision';
  if (t.includes('guide')) return 'Guideline';
  return fallback;
}

async function runSource(source: ScrapeSource): Promise<ScrapeRunResult> {
  const ranAt = new Date().toISOString();
  const fetched = await fetchHtml(source.listUrl);

  if (!fetched.ok || !fetched.html) {
    const result: ScrapeRunResult = {
      source: source.id,
      ranAt,
      ok: false,
      found: 0,
      created: 0,
      message: `Fetch failed: ${fetched.error ?? `HTTP ${fetched.status}`}. Check listUrl in sources.ts is still current, and that this host can reach ${source.baseUrl}.`,
    };
    await scrapeRunsCollection.insert(result);
    return result;
  }

  const parsed = parseListing(fetched.html, source.baseUrl);

  if (parsed.items.length === 0) {
    const result: ScrapeRunResult = {
      source: source.id,
      ranAt,
      ok: false,
      found: 0,
      created: 0,
      message: `Page fetched but no listing pattern matched. ${parsed.diagnostics} — the page likely needs a selector added to parseListing.ts, or renders its list client-side (in which case fetchHtml.ts needs to become a headless-browser fetch).`,
    };
    await scrapeRunsCollection.insert(result);
    return result;
  }

  let created = 0;
  const existingUrls = new Set(updatesCollection.all().map((u) => u.sourceUrl));

  for (const item of parsed.items) {
    if (existingUrls.has(item.href)) continue; // already known, skip (dedup by source URL)

    const now = new Date().toISOString();
    const record: UpdateRecord = {
      id: `upd-${crypto.randomUUID()}`,
      authority: source.authority,
      kind: inferKind(item.title, source.defaultKind),
      title: item.title,
      date: item.dateIso ?? now.slice(0, 10),
      summary: '', // deliberately blank: a scraper should not invent a
      detail: '', // "simplified summary" of tax law — a curator fills
      relatedCats: [], // these in via PATCH before the item can publish.
      sourceLabel: source.id,
      sourceUrl: item.href,
      status: 'pending',
      rawExcerpt: item.excerpt + (item.dateText ? ` [date found: ${item.dateText}]` : ' [no date found on page]'),
      discoveredBy: 'scraper',
      notified: false,
      createdAt: now,
      updatedAt: now,
    };
    await updatesCollection.insert(record);
    existingUrls.add(item.href);
    created += 1;
  }

  const result: ScrapeRunResult = {
    source: source.id,
    ranAt,
    ok: true,
    found: parsed.items.length,
    created,
    message: `${parsed.diagnostics}. ${created} new pending item(s) queued for review; ${
      parsed.items.length - created
    } already known.`,
  };
  await scrapeRunsCollection.insert(result);
  return result;
}

export async function runAllScrapers(): Promise<ScrapeRunResult[]> {
  const results: ScrapeRunResult[] = [];
  for (const source of SOURCES) {
    // Sequential, not parallel: gentler on the target site and keeps run
    // logs easy to read.
    // eslint-disable-next-line no-await-in-loop
    results.push(await runSource(source));
  }
  return results;
}

// Allows `npm run scrape:once` for a manual, ad-hoc run without starting
// the HTTP server.
if (require.main === module) {
  runAllScrapers()
    .then((results) => {
      console.log(JSON.stringify(results, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
