import { toPublicUser } from '@app/server/auth';
import { handler, json, requireUser } from '@app/server/http';

export const GET = handler(async () => {
  return json(toPublicUser(await requireUser()));
});
