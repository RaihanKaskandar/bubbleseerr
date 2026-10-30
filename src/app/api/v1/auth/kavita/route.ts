import { z } from 'zod';

import { handler, json, parseBody, requireUser } from '@app/server/http';
import { linkKavita, unlinkKavita } from '@app/server/users';

const schema = z.object({
  login: z.string().min(1).max(200),
  password: z.string().min(1).max(500),
});

/** Connect the signed-in local account to a Kavita account */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const { login, password } = await parseBody(request, schema);
  return json(await linkKavita(user, login, password));
});

export const DELETE = handler(async () => {
  return json(unlinkKavita(await requireUser()));
});
