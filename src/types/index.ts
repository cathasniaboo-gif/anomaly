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

export interface KnowledgeItem {
  id: string;
  cat: Category;
  icon: string;
  q: string;
  a: string;
  src: string;
  updated: string;
  keywords?: string[];
}

export type UpdateAuthority = 'FTA' | 'MoF' | 'IASB/ISSB' | 'MOHRE' | 'ICP/GDRFA' | 'Other';

export type UpdateKind = 'Guideline' | 'Public Clarification' | 'Decision' | 'Notification';

export interface RegUpdate {
  id: string;
  authority: UpdateAuthority;
  kind: UpdateKind;
  title: string;
  date: string; // ISO date
  summary: string;
  detail: string;
  relatedCats: Category[];
  sourceLabel: string;
  sourceUrl: string;
}
