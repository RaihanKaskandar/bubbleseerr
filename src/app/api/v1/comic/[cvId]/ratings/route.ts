import { handler, idParam, json, requireUser } from '@app/server/http';
import { getRatings } from '@app/server/ratings';
import { getVolumeDetails } from '@app/server/requests';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ cvId: string }> };

/** Critic and fan ratings from Comic Book Roundup; null when unknown */
export const GET = handler(async (_request: Request, { params }: Params) => {
  await requireUser();
  const comicvineId = idParam.parse((await params).cvId);
  try {
    const volume = await getVolumeDetails(comicvineId);
    return json(await getRatings(comicvineId, volume.title, volume.year, volume.publisher));
  } catch {
    return json(null);
  }
});
