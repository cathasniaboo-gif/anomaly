// Polite, defensive fetch: identifies itself, times out, and never throws
// on a non-2xx status (callers get an explicit ok/error result instead).

export interface FetchResult {
  ok: boolean;
  status?: number;
  html?: string;
  error?: string;
}

const USER_AGENT =
  process.env.SCRAPER_USER_AGENT ||
  'UAE-Reg-App-Bot/1.0 (+regulatory update aggregator; contact via project README)';

export async function fetchHtml(url: string, timeoutMs = 20000): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    return { ok: true, status: res.status, html };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}
