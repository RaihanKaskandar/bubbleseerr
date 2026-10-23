import { calendarEntries } from '@app/server/discover';
import { ApiError, handler, json, requireUser } from '@app/server/http';
import { bubblarrErrorToApiError } from '@app/server/requests';
import { effectivePublishers } from '@app/server/users';

export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const GET = handler(async (request: Request) => {
  const user = await requireUser();
  const params = new URL(request.url).searchParams;
  const start = params.get('start') ?? '';
  const end = params.get('end') ?? '';
  if (!DATE.test(start) || !DATE.test(end) || end < start) {
    throw new ApiError(400, 'start and end must be dates (YYYY-MM-DD)', 'bad_request');
  }
  if ((Date.parse(end) - Date.parse(start)) / 86400000 > 62) {
    throw new ApiError(400, 'At most 62 days at once', 'bad_request');
  }
  try {
    return json(await calendarEntries(start, end, params.get('all') === '1', effectivePublishers(user)));
  } catch (e) {
    throw bubblarrErrorToApiError(e);
  }
});
