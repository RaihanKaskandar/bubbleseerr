import { recentlyAdded } from '@app/server/discover';
import { handler, json, requireUser } from '@app/server/http';
import { bubblarrErrorToApiError } from '@app/server/requests';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireUser();
  try {
    return json(await recentlyAdded());
  } catch (e) {
    throw bubblarrErrorToApiError(e);
  }
});
