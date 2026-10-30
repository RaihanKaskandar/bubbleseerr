/**
 * The rows of the Discover page, for putting in the page itself: the browser
 * then has them on first paint, without loading skeletons or extra requests.
 */
import { newComicBookDay, newFirstIssues, publisherTiles, recentlyAdded, startingPoints, upcoming } from '@app/server/discover';
import type { User } from '@app/server/db/schema';
import { listRequests } from '@app/server/requests';
import { effectivePublishers } from '@app/server/users';

/** The page doesn't wait longer than this; slower rows load in the browser */
const PRELOAD_BUDGET = 150;
const REQUESTS_TAKE = 10;

/** The data per API address, for SWR's `fallback` */
export async function preloadDiscover(user: User): Promise<Record<string, unknown>> {
  const publishers = effectivePublishers(user);
  const rows: Record<string, () => Promise<unknown>> = {
    '/api/v1/discover/ncbd': () => newComicBookDay(publishers),
    '/api/v1/discover/recent': () => recentlyAdded(),
    '/api/v1/discover/first-issues': () => newFirstIssues(publishers),
    '/api/v1/discover/publishers': () => publisherTiles(publishers),
    '/api/v1/discover/starters': () => startingPoints(publishers),
    '/api/v1/discover/upcoming': () => upcoming(),
    [`/api/v1/requests?take=${REQUESTS_TAKE}`]: async () => {
      const { results, total } = listRequests(user, { take: REQUESTS_TAKE });
      return {
        pageInfo: { page: 1, pages: Math.max(Math.ceil(total / REQUESTS_TAKE), 1), pageSize: REQUESTS_TAKE, results: total },
        results,
      };
    },
  };

  const budget = new Promise<undefined>((resolve) => setTimeout(resolve, PRELOAD_BUDGET));
  const loaded = await Promise.all(
    Object.entries(rows).map(async ([url, load]) => [
      url,
      await Promise.race([load().catch(() => undefined), budget]),
    ])
  );
  return Object.fromEntries(loaded.filter(([, value]) => value !== undefined));
}
