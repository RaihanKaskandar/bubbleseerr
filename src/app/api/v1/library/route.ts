import { libraryCards } from '@app/server/discover';
import { handler, json, requireUser } from '@app/server/http';
import { bubblarrErrorToApiError } from '@app/server/requests';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireUser();
  try {
    return json(await libraryCards());
  } catch (e) {
    throw bubblarrErrorToApiError(e);
  }
});
