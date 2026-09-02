import * as cheerio from 'cheerio';

export interface ScrapedItem {
  title: string;
  href: string; // absolute URL
  dateIso: string | null;
  dateText: string | null;
  excerpt: string;
}

export interface ParseResult {
  items: ScrapedItem[];
  selectorUsed: string | null;
  diagnostics: string;
}

// A government publications page is usually one of: an HTML table, a list
// of cards/tiles from a CMS component, or a plain <ul>/<li> list. Since this
// was built without access to the real target pages (see sources.ts), we
// don't know which — so try a spread of common patterns and keep whichever
// one looks most like a real listing (most rows yield both a link and a
// date). This is inherently best-effort; recalibrate against real markup
// before trusting it in production.
const CANDIDATE_ROW_SELECTORS = [
  'table tbody tr',
  'table tr',
  '.views-row', // common Drupal listing pattern
  '.result-item',
  '.publication-item',
  '.clarification-item',
  '.news-item',
  'article',
  '.card',
  'li.list-item',
  'ul > li',
];

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const DATE_PATTERNS: { re: RegExp; toIso: (m: RegExpMatchArray) => string | null }[] = [
  {
    // 2026-05-12
    re: /\b(\d{4})-(\d{2})-(\d{2})\b/,
    toIso: (m) => `${m[1]}-${m[2]}-${m[3]}`,
  },
  {
    // 12/05/2026 or 12-05-2026 (assume DD/MM/YYYY, the common UAE convention)
    re: /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/,
    toIso: (m) => {
      const day = m[1].padStart(2, '0');
      const month = m[2].padStart(2, '0');
      if (Number(month) > 12) return null;
      return `${m[3]}-${month}-${day}`;
    },
  },
  {
    // "12 May 2026"
    re: /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i,
    toIso: (m) => {
      const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
      return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    },
  },
  {
    // "May 12, 2026"
    re: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i,
    toIso: (m) => {
      const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
      return `${m[3]}-${String(month).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    },
  },
];

function extractDate(text: string): { iso: string | null; raw: string | null } {
  for (const { re, toIso } of DATE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const iso = toIso(m);
      if (iso) return { iso, raw: m[0] };
    }
  }
  return { iso: null, raw: null };
}

function resolveHref(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractRow($: cheerio.CheerioAPI, el: any, baseUrl: string): ScrapedItem | null {
  const $row = $(el);
  const rowText = $row.text().replace(/\s+/g, ' ').trim();
  if (!rowText) return null;

  const $link = $row.find('a[href]').first();
  const href = $link.attr('href');
  if (!href || href.startsWith('#') || href.toLowerCase().startsWith('javascript:')) return null;
  const absoluteHref = resolveHref(href, baseUrl);
  if (!absoluteHref) return null;

  // Prefer a heading inside the row for the title; fall back to the link
  // text, then the whole row text (trimmed).
  const headingText = $row.find('h1,h2,h3,h4,h5,strong,b').first().text().trim();
  const linkText = $link.text().trim();
  const title = (headingText || linkText || rowText).slice(0, 220);
  if (!title || title.length < 8) return null;

  const { iso, raw } = extractDate(rowText);

  return {
    title,
    href: absoluteHref,
    dateIso: iso,
    dateText: raw,
    excerpt: rowText.slice(0, 500),
  };
}

export function parseListing(html: string, baseUrl: string): ParseResult {
  const $ = cheerio.load(html);
  let best: { selector: string; items: ScrapedItem[]; score: number } | null = null;
  const attempts: string[] = [];

  for (const selector of CANDIDATE_ROW_SELECTORS) {
    const elements = $(selector).toArray();
    if (elements.length < 2) continue;

    const capped = elements.slice(0, 80);
    const extracted = capped
      .map((el) => extractRow($, el, baseUrl))
      .filter((x): x is ScrapedItem => x !== null);

    if (extracted.length === 0) continue;

    const linkCoverage = extracted.length / capped.length;
    const dateCoverage = extracted.filter((x) => x.dateIso).length / extracted.length;
    const score = linkCoverage * 0.6 + dateCoverage * 0.4;

    attempts.push(
      `${selector}: ${capped.length} rows, ${extracted.length} with link, ${
        extracted.filter((x) => x.dateIso).length
      } with date (score ${score.toFixed(2)})`
    );

    // Require a minimum of usable rows so a stray sidebar <ul> doesn't win.
    if (extracted.length >= 2 && score > 0.4 && (!best || score > best.score)) {
      // De-dupe by href within this candidate.
      const seen = new Set<string>();
      const deduped = extracted.filter((x) => (seen.has(x.href) ? false : (seen.add(x.href), true)));
      best = { selector, items: deduped, score };
    }
  }

  if (!best) {
    return {
      items: [],
      selectorUsed: null,
      diagnostics: `No candidate selector scored well enough. Tried: ${attempts.join(' | ') || 'none matched'}`,
    };
  }

  return {
    items: best.items.slice(0, 40),
    selectorUsed: best.selector,
    diagnostics: `Selected "${best.selector}" (score ${best.score.toFixed(2)}). All attempts: ${attempts.join(' | ')}`,
  };
}
