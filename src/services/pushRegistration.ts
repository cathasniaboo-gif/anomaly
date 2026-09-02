import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { API_BASE_URL, HAS_BACKEND } from '../config';
import { ensureNotificationPermission } from './notifications';

// Registers this device for REAL server-sent push (delivered even when the
// app is closed) — distinct from the local notifications in
// services/notifications.ts, which only fire while the app has been opened
// at least once to notice new data. Requires both a configured backend
// (EXPO_PUBLIC_API_BASE_URL) and an EAS project id (app.json
// extra.eas.projectId, created via `eas init`) since Expo push tokens are
// scoped to a project. Silently no-ops if either is missing — the app
// still works fully offline via local notifications.
export async function registerForRemotePush(): Promise<void> {
  if (!HAS_BACKEND) return;
  if (Platform.OS === 'web') return; // no push tokens on web

  const granted = await ensureNotificationPermission();
  if (!granted) return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
  if (!projectId) {
    console.warn(
      '[push] No EAS project id configured (app.json extra.eas.projectId). Run `eas init` to ' +
        'create one — until then this device only gets notifications while the app is open.'
    );
    return;
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const res = await fetch(`${API_BASE_URL}/api/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenResponse.data, platform: Platform.OS }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.warn('[push] Failed to register this device for remote push:', err);
  }
}
