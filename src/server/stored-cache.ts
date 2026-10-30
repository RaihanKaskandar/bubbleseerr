/**
 * For data that is slow to get and fine to show a bit old. It is kept in the
 * database, so it survives a restart, and once there is a copy reading never
 * waits: an old copy is returned right away and refreshed in the background.
 *
 * The state is on globalThis because the background jobs get their own copy
 * of this module from Next.
 */
import { eq } from 'drizzle-orm';

import { getDb } from '@app/server/db';
import { cache } from '@app/server/db/schema';

interface State {
  entry: { value: unknown; fetchedAt: number } | null;
  refreshing: Promise<unknown> | null;
  lastAttempt: number;
}

const g = globalThis as unknown as { bubbleseerrStored?: Map<string, State> };
const states = (g.bubbleseerrStored ??= new Map<string, State>());

/** Don't try again sooner than this, e.g. after hitting ComicVine's rate limit */
const RETRY_AFTER = 10 * 60 * 1000;

export class StoredCache<V> {
  constructor(
    private key: string,
    /** After this long, the next read refreshes it */
    private freshFor: number,
    private compute: () => Promise<V>
  ) {}

  private get state(): State {
    let state = states.get(this.key);
    if (!state) {
      state = { entry: null, refreshing: null, lastAttempt: 0 };
      states.set(this.key, state);
    }
    return state;
  }

  private read(): State['entry'] {
    const state = this.state;
    if (!state.entry) {
      const row = getDb().select().from(cache).where(eq(cache.key, this.key)).get();
      if (row) {
        state.entry = { value: JSON.parse(row.value), fetchedAt: row.fetchedAt };
      }
    }
    return state.entry;
  }

  /** The stored copy; only waits when there is none yet */
  async get(): Promise<V> {
    const entry = this.read();
    if (!entry) {
      return this.refresh();
    }
    void this.refreshIfStale();
    return entry.value as V;
  }

  /** Never throws: the stored copy stays when refreshing fails */
  async refreshIfStale(): Promise<void> {
    const state = this.state;
    const entry = this.read();
    if (
      (entry && Date.now() - entry.fetchedAt < this.freshFor) ||
      state.refreshing ||
      Date.now() - state.lastAttempt < RETRY_AFTER
    ) {
      return;
    }
    try {
      await this.refresh();
    } catch (e) {
      console.warn(`Refreshing ${this.key} failed:`, e instanceof Error ? e.message : e);
    }
  }

  private refresh(): Promise<V> {
    const state = this.state;
    if (state.refreshing) {
      return state.refreshing as Promise<V>;
    }
    state.lastAttempt = Date.now();
    const refreshing = this.compute()
      .then((value) => {
        const fetchedAt = Date.now();
        const json = JSON.stringify(value);
        getDb()
          .insert(cache)
          .values({ key: this.key, value: json, fetchedAt })
          .onConflictDoUpdate({ target: cache.key, set: { value: json, fetchedAt } })
          .run();
        state.entry = { value, fetchedAt };
        return value;
      })
      .finally(() => {
        state.refreshing = null;
      });
    state.refreshing = refreshing;
    return refreshing;
  }
}
