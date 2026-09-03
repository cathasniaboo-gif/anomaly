// Mirrors src/types/audit.ts on the mobile-app side (LedgerEntry / Finding /
// LedgerSummary) so API responses drop straight into the app's audit screens
// with no mapping layer. If you change one side, change the other.

export type LedgerSource = 'import' | 'quickbooks' | 'xero';

// A single posted line: one side of a journal entry, an invoice, a bill, a
// deposit, whatever the source system calls it. Ledger scrutiny only needs
// the fields below — everything else from an import or a connector sync
// gets mapped down to this shape before any rule runs.
export interface LedgerEntry {
  id: string;
  date: string; // ISO date (yyyy-mm-dd)
  account: string;
  description: string;
  reference: string; // voucher/cheque/invoice number if present, else ''
  debit: number; // >= 0, in the ledger's stated currency units
  credit: number; // >= 0
  currency: string;
  enteredBy: string; // '' if unknown
  raw?: Record<string, string>; // original row/fields, for drill-down only
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

export interface LedgerRecord {
  id: string;
  name: string;
  source: LedgerSource;
  importedAt: string;
  entries: LedgerEntry[];
  findings: Finding[];
  summary: ScrutinySummary;
}

// The public shape served by the list endpoint — entries/findings stripped
// so the list view stays cheap even with large ledgers.
export interface LedgerListItem {
  id: string;
  name: string;
  source: LedgerSource;
  importedAt: string;
  summary: ScrutinySummary;
}

export function toLedgerListItem(rec: LedgerRecord): LedgerListItem {
  const { id, name, source, importedAt, summary } = rec;
  return { id, name, source, importedAt, summary };
}

export interface ConnectionRecord {
  connectorId: string; // 'quickbooks' | 'xero'
  realmId: string; // company/tenant id at the provider
  companyName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO timestamp
  connectedAt: string;
}

export interface OAuthStateRecord {
  state: string;
  connectorId: string;
  createdAt: string;
}
