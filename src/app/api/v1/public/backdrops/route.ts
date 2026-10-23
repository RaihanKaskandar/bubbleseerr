import { bubblarr } from '@app/server/bubblarr';
import { TtlCache } from '@app/server/cache';
import { handler, json } from '@app/server/http';
import { getSettings } from '@app/server/settings';

export const dynamic = 'force-dynamic';

const cache = new TtlCache<number[]>(60 * 60 * 1000, 1);

/**
 * Covers for the background of the login page, like Seerr's backdrops. Only
 * the IDs of library volumes, the images come from the image proxy.
 */
export const GET = handler(async () => {
  if (!getSettings().initialized) {
    return json([]);
  }
  try {
    const ids = await cache.getOrSet('backdrops', async () =>
      (await bubblarr.libraryVolumes('recently_added'))
        .slice(0, 20)
        .map((v) => v.id)
    );
    return json(ids);
  } catch {
    return json([]);
  }
});
