import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { devicesCollection } from './db';
import { UpdateRecord } from './types';

const expo = new Expo();

export async function registerDevice(token: string, platform: 'ios' | 'android' | 'web' | 'unknown') {
  if (!Expo.isExpoPushToken(token) && platform !== 'web') {
    throw new Error('Not a valid Expo push token.');
  }
  const now = new Date().toISOString();
  const existing = devicesCollection.find((d) => d.token === token);
  if (existing) {
    await devicesCollection.update((d) => d.token === token, { lastSeenAt: now, platform });
  } else {
    await devicesCollection.insert({ token, platform, registeredAt: now, lastSeenAt: now });
  }
}

export async function unregisterDevice(token: string) {
  await devicesCollection.remove((d) => d.token === token);
}

// Sends one push per device for a newly-published update. Called by the
// admin publish route — never by the scraper directly, since nothing
// reaches a device until a human has reviewed and approved the summary.
export async function notifyDevicesOfUpdate(update: UpdateRecord): Promise<{ sent: number; errors: string[] }> {
  const devices = devicesCollection.filter((d) => Expo.isExpoPushToken(d.token));
  if (devices.length === 0) return { sent: 0, errors: [] };

  const messages: ExpoPushMessage[] = devices.map((d) => ({
    to: d.token,
    sound: 'default',
    title: `New ${update.kind.toLowerCase()} from ${update.authority}`,
    body: update.summary,
    data: { updateId: update.id },
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const errors: string[] = [];
  let sent = 0;
  const staleTokens: string[] = [];

  for (const chunk of chunks) {
    let tickets: ExpoPushTicket[];
    try {
      tickets = await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
      continue;
    }
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'ok') {
        sent += 1;
      } else {
        errors.push(ticket.message ?? 'unknown push error');
        // DeviceNotRegistered means the token is dead — stop trying it.
        if (ticket.details?.error === 'DeviceNotRegistered') {
          staleTokens.push(chunk[i].to as string);
        }
      }
    });
  }

  for (const token of staleTokens) {
    await devicesCollection.remove((d) => d.token === token);
  }

  return { sent, errors };
}
