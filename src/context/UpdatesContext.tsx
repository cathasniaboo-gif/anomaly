import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RegUpdate } from '../types';
import { sortedUpdates } from '../data/updates';
import { notifyNewUpdate } from '../services/notifications';

const SEEN_KEY = 'uaereg:seenUpdateIds:v1';
const NOTIFIED_KEY = 'uaereg:notifiedUpdateIds:v1';

interface UpdatesContextValue {
  updates: RegUpdate[];
  unreadCount: number;
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  loading: boolean;
}

const UpdatesContext = createContext<UpdatesContextValue | null>(null);

async function loadIdSet(key: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

async function saveIdSet(key: string, set: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // best-effort persistence; unread state simply resets on failure
  }
}

export function UpdatesProvider({ children }: { children: React.ReactNode }) {
  const updates = useMemo(() => sortedUpdates(), []);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [seen, notified] = await Promise.all([
        loadIdSet(SEEN_KEY),
        loadIdSet(NOTIFIED_KEY),
      ]);
      if (cancelled) return;
      setSeenIds(seen);
      setLoading(false);

      // Pop a local notification for any update the device hasn't been
      // alerted about yet (e.g. first launch after this update shipped).
      const toNotify = updates.filter((u) => !notified.has(u.id));
      if (toNotify.length > 0) {
        const nextNotified = new Set(notified);
        for (const update of toNotify) {
          await notifyNewUpdate(update);
          nextNotified.add(update.id);
        }
        if (!cancelled) await saveIdSet(NOTIFIED_KEY, nextNotified);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markRead = useCallback((id: string) => {
    setSeenIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveIdSet(SEEN_KEY, next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setSeenIds(() => {
      const next = new Set(updates.map((u) => u.id));
      saveIdSet(SEEN_KEY, next);
      return next;
    });
  }, [updates]);

  const isRead = useCallback((id: string) => seenIds.has(id), [seenIds]);

  const unreadCount = useMemo(
    () => updates.filter((u) => !seenIds.has(u.id)).length,
    [updates, seenIds]
  );

  const value: UpdatesContextValue = {
    updates,
    unreadCount,
    isRead,
    markRead,
    markAllRead,
    loading,
  };

  return <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>;
}

export function useUpdates(): UpdatesContextValue {
  const ctx = useContext(UpdatesContext);
  if (!ctx) throw new Error('useUpdates must be used within an UpdatesProvider');
  return ctx;
}
