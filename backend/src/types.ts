// Mirrors mobile-app/src/types/index.ts (RegUpdate / Category) so the API
// response can be dropped straight into the app's UpdatesContext with no
// mapping layer. If you change one side, change the other.

export type Category =
  | 'Corporate Tax'
  | 'Free Zone vs Mainland'
  | 'VAT & Tax Procedures'
  | 'Global Minimum Tax'
  | 'IFRS / IAS'
  | 'Compliance & Registers'
  | 'Setting Up & Structuring'
  | 'Free Zone Directory'
  | 'Labour & Employment'
  | 'Immigration & Visas'
  | 'Data Protection & IP'
  | 'Courts & Dispute Resolution'
  | 'Real Estate & Ownership';

export type UpdateAuthority = 'FTA' | 'MoF' | 'IASB/ISSB' | 'MOHRE' | 'ICP/GDRFA' | 'Other';
export type UpdateKind = 'Guideline' | 'Public Clarification' | 'Decision' | 'Notification';
export type UpdateStatus = 'pending' | 'published';

// The record as scraped/curated internally — includes review-workflow fields
// that never leave the admin API.
export interface UpdateRecord {
  id: string;
  authority: UpdateAuthority;
  kind: UpdateKind;
  title: string;
  date: string; // ISO date
  summary: string; // plain-English one-liner; required before publish
  detail: string; // longer explanation; required before publish
  relatedCats: Category[];
  sourceLabel: string;
  sourceUrl: string;
  status: UpdateStatus;
  rawExcerpt: string; // scraped context, for the human reviewer only
  discoveredBy: 'scraper' | 'manual';
  notified: boolean; // whether a push has been dispatched for this item
  createdAt: string;
  updatedAt: string;
}

// The public shape served by GET /api/updates — matches the mobile app's
// RegUpdate exactly (review-workflow fields stripped).
export interface PublicUpdate {
  id: string;
  authority: UpdateAuthority;
  kind: UpdateKind;
  title: string;
  date: string;
  summary: string;
  detail: string;
  relatedCats: Category[];
  sourceLabel: string;
  sourceUrl: string;
}

export function toPublicUpdate(rec: UpdateRecord): PublicUpdate {
  const { id, authority, kind, title, date, summary, detail, relatedCats, sourceLabel, sourceUrl } = rec;
  return { id, authority, kind, title, date, summary, detail, relatedCats, sourceLabel, sourceUrl };
}

export interface DeviceRecord {
  token: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  registeredAt: string;
  lastSeenAt: string;
}

export interface ScrapeRunResult {
  source: string;
  ranAt: string;
  ok: boolean;
  found: number;
  created: number;
  message: string;
}
