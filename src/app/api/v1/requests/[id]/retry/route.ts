import { handler, idParam, json, requireUser } from '@app/server/http';
import { retryRequest } from '@app/server/requests';

type Params = { params: Promise<{ id: string }> };

/** Let Bubblarr search for the comic again */
export const POST = handler(async (_request: Request, { params }: Params) => {
  const user = await requireUser();
  return json(await retryRequest(user, idParam.parse((await params).id)));
});
