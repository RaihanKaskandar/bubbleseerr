import { cookies } from 'next/headers';

import { deleteSession, SESSION_COOKIE } from '@app/server/auth';
import { getSessionToken, handler, json } from '@app/server/http';

export const POST = handler(async () => {
  deleteSession(await getSessionToken());
  (await cookies()).delete(SESSION_COOKIE);
  return json({ success: true });
});
