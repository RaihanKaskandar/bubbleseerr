import { bubblarr, type LookupVolume } from '@app/server/bubblarr';
import { TtlCache } from '@app/server/cache';

// Searching costs a ComicVine call, so results are remembered for a while
const cache = new TtlCache<LookupVolume[]>(15 * 60 * 1000, 100);

export function searchComics(query: string): Promise<LookupVolume[]> {
  return cache.getOrSet(query.trim().toLowerCase(), () => bubblarr.search(query));
}

/** Forget cached results, e.g. after a request changed a library status */
export function clearSearchCache(): void {
  cache.clear();
}
