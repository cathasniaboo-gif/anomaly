import { LedgerEntry } from '../types';
import { AccountingConnector, TokenSet } from './types';
import { exchangeAuthCodeForToken, expiresAtFromSeconds } from './oauth';

// Xero, via its OAuth2 + Accounting API. Built against Xero's public API
// reference (developer.xero.com); this sandbox has no outbound network
// access to Xero's endpoints, so — same caveat as the QuickBooks connector
// and the FTA/MoF scraper — this is unverified against a live org. Set
// XERO_CLIENT_ID/XERO_CLIENT_SECRET/XERO_REDIRECT_URI and exercise
// `/api/audit/connectors/xero/auth-url` end to end before relying on it.

const AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';
const TOKEN_URL = 'https://identity.xero.com/connect/token';
const SCOPE = 'openid profile email accounting.transactions.read accounting.reports.read offline_access';

function creds() {
  return {
    clientId: process.env.XERO_CLIENT_ID || '',
    clientSecret: process.env.XERO_CLIENT_SECRET || '',
    redirectUri: process.env.XERO_REDIRECT_URI || '',
  };
}

// Xero's OAuth callback doesn't carry the tenant id — a connected org
// ("tenant") is discovered via a follow-up call to /connections using the
// fresh access token.
async function fetchFirstTenant(accessToken: string): Promise<{ tenantId: string; tenantName: string }> {
  const res = await fetch('https://api.xero.com/connections', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Xero /connections failed (HTTP ${res.status}): ${await res.text()}`);
  const list = (await res.json()) as Array<{ tenantId: string; tenantName: string }>;
  if (!list.length) throw new Error('No Xero organisation is authorized for this connection yet.');
  return { tenantId: list[0].tenantId, tenantName: list[0].tenantName ?? '' };
}

// A positive NetAmount on a Xero journal line is a debit, negative a
// credit (per Xero's Journals API reference).
function mapJournals(journals: any[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  for (const j of journals) {
    const date = (j.JournalDate ?? '').slice(0, 10);
    const reference = j.Reference ?? String(j.JournalNumber ?? '');
    for (const line of j.JournalLines ?? []) {
      const net = Number(line.NetAmount) || 0;
      entries.push({
        id: `xero-${line.JournalLineID ?? `${j.JournalID}-${entries.length}`}`,
        date,
        account: line.AccountName ?? line.AccountCode ?? '',
        description: line.Description ?? '',
        reference,
        debit: net > 0 ? net : 0,
        credit: net < 0 ? Math.abs(net) : 0,
        currency: 'XXX',
        enteredBy: '',
        raw: line,
      });
    }
  }
  return entries;
}

export const xeroConnector: AccountingConnector = {
  id: 'xero',
  name: 'Xero',

  isConfigured() {
    const c = creds();
    return Boolean(c.clientId && c.clientSecret && c.redirectUri);
  },

  buildAuthUrl(state: string) {
    const c = creds();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: c.clientId,
      redirect_uri: c.redirectUri,
      scope: SCOPE,
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCode(code: string): Promise<TokenSet> {
    const c = creds();
    const json = await exchangeAuthCodeForToken(
      TOKEN_URL,
      { grant_type: 'authorization_code', code, redirect_uri: c.redirectUri },
      { clientId: c.clientId, clientSecret: c.clientSecret }
    );
    const tenant = await fetchFirstTenant(json.access_token);
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: expiresAtFromSeconds(json.expires_in ?? 1800),
      realmId: tenant.tenantId,
      companyName: tenant.tenantName,
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
      expiresAt: expiresAtFromSeconds(json.expires_in ?? 1800),
      realmId,
      companyName: '',
    };
  },

  async fetchLedgerEntries(accessToken: string, realmId: string): Promise<LedgerEntry[]> {
    const res = await fetch('https://api.xero.com/api.xro/2.0/Journals?offset=0', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'xero-tenant-id': realmId,
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Xero Journals fetch failed (HTTP ${res.status}): ${await res.text()}`);
    const json = (await res.json()) as { Journals?: any[] };
    return mapJournals(json.Journals ?? []);
  },
};
