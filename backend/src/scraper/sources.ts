import { UpdateAuthority, UpdateKind } from '../types';

export interface ScrapeSource {
  id: string;
  authority: UpdateAuthority;
  defaultKind: UpdateKind;
  listUrl: string;
  baseUrl: string; // used to resolve relative hrefs
}

// IMPORTANT — read before relying on this list:
//
// This backend could not be developed against the real tax.gov.ae / mof.gov.ae
// pages: the sandbox this was built in has no outbound network access to
// those domains (or almost anything outside npm/GitHub), so these listUrls
// are best-effort guesses at plausible FTA/MoF publication pages, not
// confirmed working endpoints, and parseListing.ts's selector-guessing was
// only validated against a synthetic fixture (test/fixtures/sample-listing.html),
// never the live markup.
//
// Before trusting this in production:
//   1. From a machine with normal internet access, open each listUrl below
//      and confirm it's still the right page (government sites restructure
//      URLs without notice).
//   2. Run `npm run scrape:once` (or POST /api/admin/scrape/run) and check
//      GET /api/admin/scrape/runs — if `found` is 0 or the items look wrong,
//      the heuristic selector-guessing in parseListing.ts picked the wrong
//      element or the site needs JS rendering (in which case swap fetchHtml
//      for a headless-browser fetch, e.g. Playwright).
//   3. Check the site's terms of use / robots.txt for automated-access
//      restrictions before scraping it on a schedule.
export const SOURCES: ScrapeSource[] = [
  {
    id: 'fta-public-clarifications',
    authority: 'FTA',
    defaultKind: 'Public Clarification',
    listUrl: 'https://tax.gov.ae/en/services/public.clarifications.aspx',
    baseUrl: 'https://tax.gov.ae',
  },
  {
    id: 'fta-legislation-updates',
    authority: 'FTA',
    defaultKind: 'Notification',
    listUrl: 'https://tax.gov.ae/en/legislation.aspx',
    baseUrl: 'https://tax.gov.ae',
  },
  {
    id: 'mof-decisions',
    authority: 'MoF',
    defaultKind: 'Decision',
    listUrl: 'https://mof.gov.ae/legislation/',
    baseUrl: 'https://mof.gov.ae',
  },
];
