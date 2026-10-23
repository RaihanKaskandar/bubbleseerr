import { Permission } from '@app/lib/permissions';
import { handler, json, requireUser } from '@app/server/http';
import { getSettings } from '@app/server/settings';
import { runSync } from '@app/server/sync';

/** Update the status of all open requests now */
export const POST = handler(async () => {
  await requireUser(Permission.MANAGE_SETTINGS);
  const changed = await runSync();
  const s = getSettings();
  return json({ changed, lastSync: s.lastSync, lastSyncError: s.lastSyncError });
});
