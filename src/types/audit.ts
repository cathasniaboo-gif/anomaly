// Mirrors backend/src/audit/types.ts — kept in sync by hand since the app
// consumes these API responses directly with no mapping layer.

export type LedgerSource = 'import' | 'quickbooks' | 'xero';

export interface LedgerEntry {
  id: string;
  date: string;
  account: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  currency: string;
  enteredBy: string;
}

export type FindingSeverity = 'high' | 'medium' | 'low';

export interface Finding {
  id: string;
  ruleId: string;
  title: string;
  severity: FindingSeverity;
  description: string;
  entryIds: string[];
}

export interface ScrutinySummary {
  entryCount: number;
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  imbalance: number;
  findingCounts: Record<FindingSeverity, number>;
}

export interface LedgerListItem {
  id: string;
  name: string;
  source: LedgerSource;
  importedAt: string;
  summary: ScrutinySummary;
}

export interface LedgerRecord extends LedgerListItem {
  entries: LedgerEntry[];
  findings: Finding[];
}

export interface RuleInfo {
  id: string;
  title: string;
  defaultSeverity: FindingSeverity;
  description: string;
}

export interface ConnectorInfo {
  id: 'quickbooks' | 'xero';
  name: string;
  configured: boolean;
  connected: boolean;
  companyName: string | null;
  connectedAt: string | null;
}
