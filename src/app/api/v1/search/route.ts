import { lookupToCards } from '@app/server/cards';
import { ApiError, handler, json, requireUser } from '@app/server/http';
import { bubblarrErrorToApiError } from '@app/server/requests';
import { searchComics } from '@app/server/search';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request: Request) => {
  await requireUser();
  const query = (new URL(request.url).searchParams.get('query') ?? '').trim();
  if (query.length < 2) {
    throw new ApiError(400, 'Type at least 2 characters', 'query_too_short');
  }
  try {
    return json({ query, results: lookupToCards(await searchComics(query)) });
  } catch (e) {
    throw bubblarrErrorToApiError(e);
  }
});
