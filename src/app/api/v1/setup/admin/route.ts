import { cookies } from 'next/headers';
import { z } from 'zod';

import { Permission } from '@app/lib/permissions';
import { createSession, SESSION_COOKIE } from '@app/server/auth';
import { ApiError, handler, json, parseBody } from '@app/server/http';
import { sessionCookieOptions } from '@app/server/session-cookie';
import { countUsers, createUser, MIN_PASSWORD_LENGTH } from '@app/server/users';

const schema = z.object({
  email: z.email().max(200),
  username: z.string().min(2).max(50).regex(/^[\w.-]+$/, 'only letters, numbers, . - and _'),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(500),
});

/** Create the first (admin) account. Only works while there are no users. */
export const POST = handler(async (request: Request) => {
  if (countUsers() > 0) {
    throw new ApiError(403, 'Setup has already created an admin', 'forbidden');
  }
  const data = await parseBody(request, schema);
  const user = await createUser(null, {
    ...data,
    permissions: Permission.ADMIN,
  });

  const session = createSession(user.id);
  (await cookies()).set(
    SESSION_COOKIE,
    session.token,
    await sessionCookieOptions(session.expiresAt)
  );
  return json(user, 201);
});
