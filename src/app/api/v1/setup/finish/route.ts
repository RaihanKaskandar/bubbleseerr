import { Permission } from '@app/lib/permissions';
import { ApiError, handler, json, requireUser } from '@app/server/http';
import { getSettings, getWebhookSecret, updateSettings } from '@app/server/settings';

export const POST = handler(async () => {
  await requireUser(Permission.ADMIN);
  const settings = getSettings();
  if (!settings.bubblarrUrl || !settings.bubblarrApiKey) {
    throw new ApiError(400, 'Connect Bubblarr first', 'not_configured');
  }
  getWebhookSecret();
  updateSettings({ initialized: true });
  return json({ initialized: true });
});
