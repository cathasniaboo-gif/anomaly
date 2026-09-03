import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

// The audit module talks to the same backend's /api/audit/* routes, which
// are gated behind an admin API key (backend/src/auth.ts) — this is
// financial ledger data, so unlike the public /api/updates feed it must
// never be reachable without a credential. That credential is entered once
// on-device (AuditSettingsScreen) and kept in AsyncStorage; it is never
// bundled into the app, unlike EXPO_PUBLIC_ build-time config.
const BACKEND_URL_KEY = 'audit.backendUrl';
const ADMIN_KEY_KEY = 'audit.adminApiKey';

export async function getAuditBackendUrl(): Promise<string> {
  const stored = await AsyncStorage.getItem(BACKEND_URL_KEY);
  return (stored ?? API_BASE_URL ?? '').replace(/\/+$/, '');
}

export async function setAuditBackendUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(BACKEND_URL_KEY, url.trim().replace(/\/+$/, ''));
}

export async function getAdminApiKey(): Promise<string> {
  return (await AsyncStorage.getItem(ADMIN_KEY_KEY)) ?? '';
}

export async function setAdminApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(ADMIN_KEY_KEY, key.trim());
}

export async function isAuditConfigured(): Promise<boolean> {
  const [url, key] = await Promise.all([getAuditBackendUrl(), getAdminApiKey()]);
  return Boolean(url && key);
}
