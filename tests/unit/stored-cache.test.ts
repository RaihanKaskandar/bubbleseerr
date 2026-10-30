import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StoredCache } from '@app/server/stored-cache';

import { useTestDb } from './helpers';

const HOUR = 60 * 60 * 1000;
let keys = 0;

/** A cache with its own key, as the state in memory outlives a test */
function storedCache(compute: () => Promise<string>) {
  const key = `test-${keys++}`;
  return { key, cache: new StoredCache<string>(key, HOUR, compute) };
}

function forgetMemory(key: string) {
  (globalThis as unknown as { bubbleseerrStored: Map<string, unknown> }).bubbleseerrStored.delete(key);
}

beforeEach(() => {
  useTestDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('StoredCache', () => {
  it('waits for the first fetch, and not after that', async () => {
    const compute = vi.fn(async () => 'one');
    const { cache } = storedCache(compute);
    expect(await cache.get()).toBe('one');
    expect(await cache.get()).toBe('one');
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('fetches once when asked several times at once', async () => {
    const compute = vi.fn(async () => 'one');
    const { cache } = storedCache(compute);
    await Promise.all([cache.get(), cache.get(), cache.get()]);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('survives a restart', async () => {
    const compute = vi.fn(async () => 'one');
    const { key, cache } = storedCache(compute);
    await cache.get();
    forgetMemory(key);
    expect(await cache.get()).toBe('one');
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('returns the old copy right away and refreshes it in the background', async () => {
    let release = () => {};
    const compute = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('old')
      .mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve('new'))));
    const { cache } = storedCache(compute);
    await cache.get();

    vi.advanceTimersByTime(HOUR + 1);
    // Doesn't wait, although the refresh isn't finished
    expect(await cache.get()).toBe('old');
    expect(compute).toHaveBeenCalledTimes(2);

    release();
    await vi.waitFor(async () => expect(await cache.get()).toBe('new'));
  });

  it('keeps the old copy when refreshing fails, and waits before trying again', async () => {
    const compute = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('old')
      .mockRejectedValue(new Error('rate limit'));
    const { cache } = storedCache(compute);
    await cache.get();

    vi.advanceTimersByTime(HOUR + 1);
    await cache.refreshIfStale();
    expect(await cache.get()).toBe('old');
    expect(compute).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(11 * 60 * 1000);
    await cache.refreshIfStale();
    expect(compute).toHaveBeenCalledTimes(3);
  });

  it('does not refresh a fresh copy', async () => {
    const compute = vi.fn(async () => 'one');
    const { cache } = storedCache(compute);
    await cache.get();
    await cache.refreshIfStale();
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('gives the error when there is nothing to show', async () => {
    const { cache } = storedCache(async () => {
      throw new Error('down');
    });
    await expect(cache.get()).rejects.toThrow('down');
  });
});
