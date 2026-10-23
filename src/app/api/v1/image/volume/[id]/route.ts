import { bubblarr } from '@app/server/bubblarr';
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
    const upstream = await bubblarr.cover(parsed.data);
    return new Response(upstream.body, {
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
