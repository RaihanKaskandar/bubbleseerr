import { handler, idParam, json, requireUser } from '@app/server/http';
import { deleteRequest } from '@app/server/requests';

type Params = { params: Promise<{ id: string }> };

/** Remove a request. The comic stays in Bubblarr. */
export const DELETE = handler(async (_request: Request, { params }: Params) => {
  const user = await requireUser();
  deleteRequest(user, idParam.parse((await params).id));
  return json({ success: true });
});
