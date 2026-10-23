/**
 * A small in-memory cache with a time limit per entry. Used to not hit
 * ComicVine (through Bubblarr) more often than needed, as it has a strict
 * rate limit.
 */
export class TtlCache<V> {
  private entries = new Map<string, { value: V; expires: number }>();
  /** Computations that are running, so they're not started twice */
  private pending = new Map<string, Promise<V>>();

  constructor(
    private ttl: number,
    private maxEntries = 500
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expires < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.entries.size >= this.maxEntries) {
      // Remove the oldest entry
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) {
        this.entries.delete(oldest);
      }
    }
    this.entries.set(key, { value, expires: Date.now() + this.ttl });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
    this.pending.clear();
  }

  /** Get the value, or compute and store it */
  async getOrSet(key: string, compute: () => Promise<V>): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const running = this.pending.get(key);
    if (running) {
      return running;
    }
    const promise = compute()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
}
