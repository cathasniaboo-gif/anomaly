import { API_BASE_URL, HAS_BACKEND } from '../config';
import { RegUpdate } from '../types';

// Fetches the live updates feed from backend/. Returns null (not []) on any
// failure or when no backend is configured, so callers can tell "backend
// said there are zero updates" apart from "couldn't reach the backend" and
// fall back to the bundled seed data accordingly.
export async function fetchRemoteUpdates(): Promise<RegUpdate[] | null> {
  if (!HAS_BACKEND) return null;
  try {
    const controller = new AbortController();
    // Free-tier hosts (e.g. Render's free plan) spin down when idle and can
    // take 30-60s to wake back up on the next request — a short timeout
    // here would abort a perfectly healthy cold-starting backend and fall
    // back to bundled data even though the real fetch was about to succeed.
    const timer = setTimeout(() => controller.abort(), 60000);
    const res = await fetch(`${API_BASE_URL}/api/updates`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Unexpected response shape');
    return data as RegUpdate[];
  } catch (err) {
    console.warn('[updatesApi] Could not reach backend, using bundled updates instead:', err);
    return null;
  }
}
