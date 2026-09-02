import cron from 'node-cron';
import { runAllScrapers } from './scraper/run';

// Default: once every 6 hours. FTA/MoF don't publish on a predictable
// cadence, and there's no benefit to polling a static government page more
// often than that — override via SCRAPE_CRON if you want a tighter loop
// while calibrating.
const SCHEDULE = process.env.SCRAPE_CRON || '0 */6 * * *';

export function startScheduler() {
  if (process.env.DISABLE_SCRAPE_SCHEDULE === 'true') {
    console.log('[scheduler] SCRAPE_CRON scheduling disabled via DISABLE_SCRAPE_SCHEDULE.');
    return;
  }
  if (!cron.validate(SCHEDULE)) {
    console.error(`[scheduler] Invalid SCRAPE_CRON expression "${SCHEDULE}" — scheduling disabled.`);
    return;
  }
  console.log(`[scheduler] Scraping on schedule "${SCHEDULE}".`);
  cron.schedule(SCHEDULE, async () => {
    console.log('[scheduler] Running scheduled scrape…');
    try {
      const results = await runAllScrapers();
      console.log('[scheduler] Scrape complete:', results.map((r) => `${r.source}: ${r.ok ? 'ok' : 'FAILED'} (${r.created} new)`).join(', '));
    } catch (err) {
      console.error('[scheduler] Scrape run threw:', err);
    }
  });
}
