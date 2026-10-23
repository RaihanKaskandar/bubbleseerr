import { NextResponse, type NextRequest } from 'next/server';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Block requests that change something when they come from another website
 * (CSRF). Browsers always send the Origin header with such requests.
 */
export function middleware(request: NextRequest) {
  if (SAFE_METHODS.includes(request.method)) {
    return NextResponse.next();
  }
  // Bubblarr's webhooks are checked with their signature instead
  if (request.nextUrl.pathname.startsWith('/api/v1/webhook/')) {
    return NextResponse.next();
  }

  const origin = request.headers.get('origin');
  if (!origin) {
    // Not from a browser (e.g. curl); cookies are the only credential, and
    // SameSite=Lax keeps them from being sent cross-site anyway
    return NextResponse.next();
  }

  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = '';
  }
  if (!host || originHost !== host) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Cross-site request blocked' },
      { status: 403 }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/v1/:path*',
};
