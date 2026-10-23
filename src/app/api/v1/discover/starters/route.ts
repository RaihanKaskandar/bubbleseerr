import { startingPoints } from '@app/server/discover';
import { handler, json, requireUser } from '@app/server/http';
import { bubblarrErrorToApiError } from '@app/server/requests';
import { effectivePublishers } from '@app/server/users';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const user = await requireUser();
  try {
    return json(await startingPoints(effectivePublishers(user)));
  } catch (e) {
    throw bubblarrErrorToApiError(e);
  }
});
