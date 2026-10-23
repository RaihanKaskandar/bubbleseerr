import { requestStatuses } from '@app/server/cards';
import { handler, idParam, json, requireUser } from '@app/server/http';
import { getKavitaLink } from '@app/server/kavita';
import { getSettings } from '@app/server/settings';
import {
  bubblarrErrorToApiError,
  getVolumeDetails,
  listRequests,
} from '@app/server/requests';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ cvId: string }> };

/** Everything the comic page needs: details, issues, requests, Kavita link */
export const GET = handler(async (request: Request, { params }: Params) => {
  const user = await requireUser();
  const comicvineId = idParam.parse((await params).cvId);
  const fresh = new URL(request.url).searchParams.get('fresh') === '1';

  let volume;
  try {
    volume = await getVolumeDetails(comicvineId, fresh);
  } catch (e) {
    throw bubblarrErrorToApiError(e);
  }

  const status = volume.library.status;
  const kavitaUrl =
    status === 'available' || status === 'partially_available'
      ? await getKavitaLink(comicvineId, volume.title, volume.year)
      : null;

  return json({
    volume,
    requestStatus: requestStatuses([comicvineId]).get(comicvineId) ?? null,
    requests: listRequests(user, { comicvineId, take: 50 }).results,
    kavitaUrl,
    /** Whether a "Find in Kavita" button makes sense */
    kavitaConfigured: !!(getSettings().kavitaUrl && getSettings().kavitaApiKey),
  });
});
