import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { RegUpdate } from '../types';

// Wraps expo-notifications so the app can pop up a local alert whenever a
// new FTA/MoF/IASB guideline lands in the updates feed (src/data/updates.ts
// today; a real backend feed tomorrow — see README.md).
//
// This only ever fires LOCAL notifications from data already inside the
// app bundle. It does not register for push tokens or talk to any remote
// push service, so it works the same in Expo Go and in a standalone build
// with zero extra backend setup.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

let permissionRequested = false;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false; // no local notification UI on web
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (permissionRequested && !current.canAskAgain) return false;
  permissionRequested = true;
  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
}

export async function notifyNewUpdate(update: RegUpdate): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `New ${update.kind.toLowerCase()} from ${update.authority}`,
      body: update.summary,
      data: { updateId: update.id },
    },
    trigger: null, // fire immediately
  });
}

export async function clearBadge(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.setBadgeCountAsync(0);
}
