import { headers } from 'next/headers';

/**
 * Options of the session cookie. It's marked Secure when the request came in
 * over HTTPS (e.g. through a reverse proxy), but not on plain HTTP, so that
 * logging in on the local network still works.
 */
export async function sessionCookieOptions(expiresAt: number) {
  const secure = (await headers()).get('x-forwarded-proto') === 'https';
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    expires: new Date(expiresAt),
    secure,
  };
}
