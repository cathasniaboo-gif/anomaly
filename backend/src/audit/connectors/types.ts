import { LedgerEntry } from '../types';

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO timestamp
  realmId: string; // company/org/tenant id at the provider
  companyName: string;
}

export interface AccountingConnector {
  id: 'quickbooks' | 'xero';
  name: string;
  // False when the required client id/secret/redirect env vars aren't set —
  // routes use this to return a clear "not configured" error instead of a
  // confusing failure deep inside an OAuth call.
  isConfigured(): boolean;
  buildAuthUrl(state: string): string;
  exchangeCode(code: string, realmIdFromCallback?: string): Promise<TokenSet>;
  refresh(refreshToken: string, realmId: string): Promise<TokenSet>;
  fetchLedgerEntries(accessToken: string, realmId: string): Promise<LedgerEntry[]>;
}
