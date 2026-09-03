import crypto from 'crypto';
import { LedgerEntry } from '../types';
import { AccountingConnector, TokenSet } from './types';
import { exchangeAuthCodeForToken, expiresAtFromSeconds } from './oauth';

// QuickBooks Online, via Intuit's OAuth2 + Accounting API. Built against
// Intuit's public API reference (developer.intuit.com); this sandbox has no
// outbound network access to Intuit's endpoints, so the request/response
// shapes below are unverified against a live app — same caveat as the
// FTA/MoF scraper in backend/src/scraper (see backend/README.md). Set
// QBO_CLIENT_ID/QBO_CLIENT_SECRET/QBO_REDIRECT_URI/QBO_ENVIRONMENT and
// exercise `/api/audit/connectors/quickbooks/auth-url` end to end before
// relying on this against a real company file.

const AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const SCOPE = 'com.intuit.quickbooks.accounting';

function apiBase(): string {
  return process.env.QBO_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
}

function creds() {
  return {
    clientId: process.env.QBO_CLIENT_ID || '',
    clientSecret: process.env.QBO_CLIENT_SECRET || '',
    redirectUri: process.env.QBO_REDIRECT_URI || '',
  };
}

async function qboQuery(accessToken: string, realmId: string, query: string): Promise<any> {
  const url = `${apiBase()}/v3/company/${encodeURIComponent(realmId)}/query?query=${encodeURIComponent(query)}&minorversion=65`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`QuickBooks query failed (HTTP ${res.status}): ${await res.text()}`);
  }
  return res.json();
}

// A QuickBooks JournalEntry line posts either Debit or Credit to one
// account. Purchases, deposits, invoices etc. are also GL postings, but a
// JournalEntry is the closest analogue to the "ledger line" this app deals
// in, so that's what a sync pulls; extend this query list if you need the
// full GL rather than manual journals.
function mapJournalEntries(qboResponse: any): LedgerEntry[] {
  const rows: any[] = qboResponse?.QueryResponse?.JournalEntry ?? [];
  const entries: LedgerEntry[] = [];
  for (const je of rows) {
    const date = je.TxnDate ?? '';
    const reference = je.DocNumber ?? '';
    const currency = je.CurrencyRef?.value ?? 'USD';
    for (const line of je.Line ?? []) {
      const detail = line.JournalEntryLineDetail;
      if (!detail) continue;
      const amount = Number(line.Amount) || 0;
      entries.push({
        id: `qbo-${je.Id}-${line.Id ?? crypto.randomUUID()}`,
        date,
        account: detail.AccountRef?.name ?? detail.AccountRef?.value ?? '',
        description: line.Description ?? je.PrivateNote ?? '',
        reference,
        debit: detail.PostingType === 'Debit' ? amount : 0,
        credit: detail.PostingType === 'Credit' ? amount : 0,
        currency,
        enteredBy: '',
        raw: line,
      });
    }
  }
  return entries;
}

export const quickbooksConnector: AccountingConnector = {
  id: 'quickbooks',
  name: 'QuickBooks Online',

  isConfigured() {
    const c = creds();
    return Boolean(c.clientId && c.clientSecret && c.redirectUri);
  },

  buildAuthUrl(state: string) {
    const c = creds();
    const params = new URLSearchParams({
      client_id: c.clientId,
      redirect_uri: c.redirectUri,
      response_type: 'code',
      scope: SCOPE,
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCode(code: string, realmIdFromCallback?: string): Promise<TokenSet> {
    const c = creds();
    if (!realmIdFromCallback) {
      throw new Error('QuickBooks callback did not include a realmId (company id).');
    }
    const json = await exchangeAuthCodeForToken(
      TOKEN_URL,
      { grant_type: 'authorization_code', code, redirect_uri: c.redirectUri },
      { clientId: c.clientId, clientSecret: c.clientSecret }
    );
    let companyName = '';
    try {
      const info = await qboQuery(json.access_token, realmIdFromCallback, `SELECT CompanyName FROM CompanyInfo`);
      companyName = info?.QueryResponse?.CompanyInfo?.[0]?.CompanyName ?? '';
    } catch {
      // Non-fatal — the connection still works without a display name.
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: expiresAtFromSeconds(json.expires_in ?? 3600),
      realmId: realmIdFromCallback,
      companyName,
    };
  },

  async refresh(refreshToken: string, realmId: string): Promise<TokenSet> {
    const c = creds();
    const json = await exchangeAuthCodeForToken(
      TOKEN_URL,
      { grant_type: 'refresh_token', refresh_token: refreshToken },
      { clientId: c.clientId, clientSecret: c.clientSecret }
    );
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? refreshToken,
      expiresAt: expiresAtFromSeconds(json.expires_in ?? 3600),
      realmId,
      companyName: '',
    };
  },

  async fetchLedgerEntries(accessToken: string, realmId: string): Promise<LedgerEntry[]> {
    const json = await qboQuery(accessToken, realmId, 'SELECT * FROM JournalEntry ORDER BY TxnDate DESC MAXRESULTS 1000');
    return mapJournalEntries(json);
  },
};
