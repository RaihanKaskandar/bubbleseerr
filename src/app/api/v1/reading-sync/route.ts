import { z } from 'zod';

import { ApiError, handler, json, parseBody, requireUser } from '@app/server/http';
import { findProfile, LocgError } from '@app/server/locg';
import {
  connectLocg,
  disconnectLocg,
  isSyncRunning,
  readingSyncStatus,
  syncReadingList,
} from '@app/server/reading-sync';

export const dynamic = 'force-dynamic';

const schema = z.object({ profile: z.string().min(1).max(200) });

export const GET = handler(async () => {
  return json(readingSyncStatus((await requireUser()).id));
});

/** Connect a League of Comic Geeks profile, and read it right away */
export const PUT = handler(async (request: Request) => {
  const user = await requireUser();
  const { profile } = await parseBody(request, schema);
  try {
    connectLocg(user.id, await findProfile(profile));
  } catch (e) {
    throw e instanceof LocgError ? new ApiError(400, e.message, 'locg_error') : e;
  }
  void syncReadingList(user.id);
  return json(readingSyncStatus(user.id));
});

export const DELETE = handler(async () => {
  const user = await requireUser();
  if (isSyncRunning(user.id)) {
    throw new ApiError(409, 'Wait until the sync is finished', 'sync_running');
  }
  disconnectLocg(user.id);
  return json(readingSyncStatus(user.id));
});

/** Sync now. It takes minutes, so this only starts it. */
export const POST = handler(async () => {
  const user = await requireUser();
  void syncReadingList(user.id);
  return json(readingSyncStatus(user.id), 202);
});
