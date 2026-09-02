import fs from 'fs';
import path from 'path';
import { UpdateRecord, DeviceRecord, ScrapeRunResult } from './types';

// A minimal JSON-file datastore. This app's write volume is tiny (a handful
// of new regulatory updates a week, occasional device registrations), so a
// single JSON file per collection with a write queue is simpler and has
// fewer moving parts than a real database — no native build step, no
// external service to provision. Swap for Postgres/SQLite if you outgrow
// it or need multiple backend instances writing concurrently (see
// backend/README.md, "Scaling the datastore").

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

class JsonCollection<T> {
  private filePath: string;
  private cache: T[] | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(fileName: string) {
    ensureDataDir();
    this.filePath = path.join(DATA_DIR, fileName);
  }

  private load(): T[] {
    if (this.cache) return this.cache;
    if (!fs.existsSync(this.filePath)) {
      this.cache = [];
      return this.cache;
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      this.cache = raw.trim() ? (JSON.parse(raw) as T[]) : [];
    } catch (err) {
      // Corrupt file shouldn't take the whole service down; start empty and
      // preserve the bad file for inspection.
      const backupPath = `${this.filePath}.corrupt-${Date.now()}`;
      try {
        fs.copyFileSync(this.filePath, backupPath);
      } catch {
        /* best effort */
      }
      console.error(`[db] failed to parse ${this.filePath}, backed up to ${backupPath}:`, err);
      this.cache = [];
    }
    return this.cache;
  }

  private persist(): Promise<void> {
    // Snapshot now: this.cache may be mutated again before this write's
    // turn comes up in the queue, and each write should reflect the state
    // at the moment its mutation happened, not whatever's latest when it
    // finally runs.
    const snapshot = JSON.stringify(this.cache, null, 2);

    // Chain writes so concurrent mutations don't interleave partial file
    // writes (Node's fs.promises.writeFile is not atomic across calls).
    const run = this.writeQueue.then(async () => {
      ensureDataDir(); // defend against the data dir disappearing after construction
      const tmpPath = `${this.filePath}.tmp`;
      await fs.promises.writeFile(tmpPath, snapshot, 'utf-8');
      await fs.promises.rename(tmpPath, this.filePath);
    });
    // The queue itself must never end up rejected, or every write after the
    // first failure would be skipped forever — swallow here, but the
    // caller's own awaited `run` still rejects so they see the real error.
    this.writeQueue = run.catch(() => {});
    return run;
  }

  all(): T[] {
    return [...this.load()];
  }

  find(predicate: (item: T) => boolean): T | undefined {
    return this.load().find(predicate);
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.load().filter(predicate);
  }

  async insert(item: T): Promise<T> {
    this.load().push(item);
    await this.persist();
    return item;
  }

  async upsert(predicate: (item: T) => boolean, item: T): Promise<T> {
    const list = this.load();
    const idx = list.findIndex(predicate);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    await this.persist();
    return item;
  }

  async update(predicate: (item: T) => boolean, patch: Partial<T>): Promise<T | undefined> {
    const list = this.load();
    const idx = list.findIndex(predicate);
    if (idx < 0) return undefined;
    list[idx] = { ...list[idx], ...patch };
    await this.persist();
    return list[idx];
  }

  async remove(predicate: (item: T) => boolean): Promise<boolean> {
    const list = this.load();
    const next = list.filter((i) => !predicate(i));
    const removed = next.length !== list.length;
    if (removed) {
      this.cache = next;
      await this.persist();
    }
    return removed;
  }
}

export const updatesCollection = new JsonCollection<UpdateRecord>('updates.json');
export const devicesCollection = new JsonCollection<DeviceRecord>('devices.json');
export const scrapeRunsCollection = new JsonCollection<ScrapeRunResult>('scrape-runs.json');
