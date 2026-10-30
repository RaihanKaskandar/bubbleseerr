import { comicVineCover, isComicVineCover } from '@app/server/covers';
import { getCurrentUser } from '@app/server/http';

/**
 * A ComicVine cover, shrunk and kept on disk. Only for logged in users, so
 * this can't be used by others to fill the disk.
 */
export async function GET(request: Request) {
  if (!(await getCurrentUser())) {
    return new Response('Log in first', { status: 401 });
  }
  const url = new URL(request.url).searchParams.get('url') ?? '';
  if (!isComicVineCover(url)) {
    return new Response('Not found', { status: 404 });
  }
  try {
    const cover = await comicVineCover(url);
    return new Response(new Uint8Array(cover.data), {
      headers: {
        'Content-Type': cover.type,
        'Cache-Control': 'private, max-age=2592000, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
