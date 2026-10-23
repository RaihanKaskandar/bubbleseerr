import { Permission } from '@app/lib/permissions';
import { handler, json, requireUser } from '@app/server/http';
import { regenerateWebhookSecret } from '@app/server/settings';

/** Make a new webhook secret (the old one stops working) */
export const POST = handler(async () => {
  await requireUser(Permission.MANAGE_SETTINGS);
  return json({ webhookSecret: regenerateWebhookSecret() });
});
