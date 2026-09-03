import { getAuditBackendUrl, getAdminApiKey } from './auditSettings';
import { ConnectorInfo, LedgerListItem, LedgerRecord, RuleInfo } from '../types/audit';

// Thrown when the backend URL or admin key hasn't been entered yet
// (AuditSettingsScreen) — screens catch this specifically to prompt the
// user to configure the connection instead of showing a generic error.
export class AuditNotConfiguredError extends Error {
  constructor() {
    super('Audit backend is not configured. Set the backend URL and admin key in Audit settings.');
    this.name = 'AuditNotConfiguredError';
  }
}

async function auditFetch(path: string, init: RequestInit = {}): Promise<any> {
  const [baseUrl, adminKey] = await Promise.all([getAuditBackendUrl(), getAdminApiKey()]);
  if (!baseUrl || !adminKey) throw new AuditNotConfiguredError();

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'x-admin-key': adminKey,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (res.status === 204) return null;

  const text = await res.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Unexpected response from server (HTTP ${res.status}): ${text.slice(0, 200)}`);
    }
  }
  if (!res.ok) {
    const message = json?.errors?.join?.('; ') ?? json?.error ?? `HTTP ${res.status}`;
    throw new Error(message);
  }
  return json;
}

export function listRules(): Promise<RuleInfo[]> {
  return auditFetch('/api/audit/rules');
}

export function listLedgers(): Promise<LedgerListItem[]> {
  return auditFetch('/api/audit/ledgers');
}

export function getLedger(id: string): Promise<LedgerRecord> {
  return auditFetch(`/api/audit/ledgers/${encodeURIComponent(id)}`);
}

export function importLedgerCsv(name: string, csv: string): Promise<LedgerRecord> {
  return auditFetch('/api/audit/ledgers/import', {
    method: 'POST',
    body: JSON.stringify({ name, csv }),
  });
}

export function rescanLedger(id: string): Promise<LedgerRecord> {
  return auditFetch(`/api/audit/ledgers/${encodeURIComponent(id)}/rescan`, { method: 'POST' });
}

export async function deleteLedger(id: string): Promise<void> {
  await auditFetch(`/api/audit/ledgers/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function listConnectors(): Promise<ConnectorInfo[]> {
  return auditFetch('/api/audit/connectors');
}

export function getConnectorAuthUrl(id: string): Promise<{ url: string }> {
  return auditFetch(`/api/audit/connectors/${encodeURIComponent(id)}/auth-url`);
}

export function syncConnector(id: string): Promise<LedgerRecord> {
  return auditFetch(`/api/audit/connectors/${encodeURIComponent(id)}/sync`, { method: 'POST' });
}

export async function disconnectConnector(id: string): Promise<void> {
  await auditFetch(`/api/audit/connectors/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
