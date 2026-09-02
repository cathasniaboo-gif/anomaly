import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RegUpdate } from '../types';
import { sortedUpdates } from '../data/updates';
import { notifyNewUpdate } from '../services/notifications';
import { fetchRemoteUpdates } from '../services/updatesApi';
import { registerForRemotePush } from '../services/pushRegistration';
import { HAS_BACKEND } from '../config';

const SEEN_KEY = 'uaereg:seenUpdateIds:v1';
const NOTIFIED_KEY = 'uaereg:notifiedUpdateIds:v1';

interface UpdatesContextValue {
  updates: RegUpdate[];
  unreadCount: number;
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  isLive: boolean; // true once a successful backend fetch has replaced the bundled seed
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
  const bundledSeed = useMemo(() => sortedUpdates(), []);
  const [updates, setUpdates] = useState<RegUpdate[]>(bundledSeed);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const notifiedRef = useRef<Set<string>>(new Set());

  const notifyForNewItems = useCallback(async (list: RegUpdate[]) => {
    const toNotify = list.filter((u) => !notifiedRef.current.has(u.id));
    if (toNotify.length === 0) return;
    for (const update of toNotify) {
      // eslint-disable-next-line no-await-in-loop
      await notifyNewUpdate(update);
      notifiedRef.current.add(update.id);
    }
    await saveIdSet(NOTIFIED_KEY, notifiedRef.current);
  }, []);

  const refresh = useCallback(async () => {
    if (!HAS_BACKEND) return;
    setRefreshing(true);
    try {
      const remote = await fetchRemoteUpdates();
      if (remote && remote.length >= 0) {
        const sorted = [...remote].sort((a, b) => (a.date < b.date ? 1 : -1));
        setUpdates(sorted);
        setIsLive(true);
        await notifyForNewItems(sorted);
      }
    } finally {
      setRefreshing(false);
    }
  }, [notifyForNewItems]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [seen, notified] = await Promise.all([loadIdSet(SEEN_KEY), loadIdSet(NOTIFIED_KEY)]);
      if (cancelled) return;
      setSeenIds(seen);
      notifiedRef.current = notified;
      setLoading(false);

      // Notify for anything in the bundled seed the device hasn't seen yet
      // (first launch, or first launch after this app version shipped).
      await notifyForNewItems(bundledSeed);

      if (HAS_BACKEND) {
        await refresh();
        registerForRemotePush().catch(() => {});
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
    refreshing,
    refresh,
    isLive,
  };

  return <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>;
}

export function useUpdates(): UpdatesContextValue {
  const ctx = useContext(UpdatesContext);
  if (!ctx) throw new Error('useUpdates must be used within an UpdatesProvider');
  return ctx;
}
