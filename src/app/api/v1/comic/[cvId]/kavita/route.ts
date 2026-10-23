import { handler, idParam, json, requireUser } from '@app/server/http';
import { findInKavita, KavitaError } from '@app/server/kavita';
import { bubblarrErrorToApiError, getVolumeDetails } from '@app/server/requests';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ cvId: string }> };

/**
 * Find a downloaded comic in Kavita. When Kavita doesn't have it yet, it is
 * asked to scan first; this waits up to half a minute for that.
 */
export const POST = handler(async (_request: Request, { params }: Params) => {
  await requireUser();
  const comicvineId = idParam.parse((await params).cvId);
  let volume;
  try {
    volume = await getVolumeDetails(comicvineId, false);
  } catch (e) {
    throw bubblarrErrorToApiError(e);
  }
  try {
    return json({ kavitaUrl: await findInKavita(comicvineId, volume.title, volume.year) });
  } catch (e) {
    return json({ kavitaUrl: null, message: e instanceof KavitaError ? e.message : "Couldn't reach Kavita" });
  }
});
