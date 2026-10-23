import { publisherComics } from '@app/server/discover';
import { ApiError, handler, json, requireUser } from '@app/server/http';
import { bubblarrErrorToApiError } from '@app/server/requests';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export const GET = handler(async (_request: Request, { params }: Params) => {
  await requireUser();
  const { slug } = await params;
  let result;
  try {
    result = await publisherComics(slug);
  } catch (e) {
    throw bubblarrErrorToApiError(e);
  }
  if (!result) {
    throw new ApiError(404, 'Unknown publisher', 'not_found');
  }
  return json({ name: result.publisher.name, results: result.results });
});
