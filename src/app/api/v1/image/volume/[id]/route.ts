import { libraryCover } from '@app/server/covers';
import { idParam } from '@app/server/http';

type Params = { params: Promise<{ id: string }> };

/**
 * The cover of a volume in Bubblarr's library. Proxied so the Bubblarr API
 * key stays on the server. Public, as the login page shows covers too.
 */
export async function GET(_request: Request, { params }: Params) {
  const parsed = idParam.safeParse((await params).id);
  if (!parsed.success) {
    return new Response('Not found', { status: 404 });
  }
  try {
    const cover = await libraryCover(parsed.data);
    return new Response(new Uint8Array(cover.data), {
      headers: {
        'Content-Type': cover.type,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
