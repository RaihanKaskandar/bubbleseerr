import { cookies } from 'next/headers';
import { z } from 'zod';

import {
  clearFailedLogins,
  createSession,
  isLoginRateLimited,
  recordFailedLogin,
  SESSION_COOKIE,
  toPublicUser,
} from '@app/server/auth';
import { ApiError, getClientIp, handler, json, parseBody } from '@app/server/http';
import { sessionCookieOptions } from '@app/server/session-cookie';
import { authenticate } from '@app/server/users';

const schema = z.object({
  login: z.string().min(1).max(200),
  password: z.string().min(1).max(500),
});

export const POST = handler(async (request: Request) => {
  const ip = await getClientIp();
  if (isLoginRateLimited(ip)) {
    throw new ApiError(
      429,
      'Too many failed logins. Try again in 15 minutes.',
      'rate_limited'
    );
  }

  const { login, password } = await parseBody(request, schema);
  const user = await authenticate(login, password);
  if (!user) {
    recordFailedLogin(ip);
    throw new ApiError(401, 'Wrong email/username or password', 'invalid_credentials');
  }
  clearFailedLogins(ip);

  const session = createSession(user.id);
  (await cookies()).set(
    SESSION_COOKIE,
    session.token,
    await sessionCookieOptions(session.expiresAt)
  );
  return json(toPublicUser(user));
});
