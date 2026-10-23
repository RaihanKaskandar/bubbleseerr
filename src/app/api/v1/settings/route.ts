import { z } from 'zod';

import { Permission } from '@app/lib/permissions';
import { cleanPublisherChoice, PUBLISHER_CHOICES } from '@app/lib/publishers';
import { normaliseUrl } from '@app/server/bubblarr';
import { handler, json, parseBody, requireUser } from '@app/server/http';
import { clearKavitaLinks } from '@app/server/kavita';
import {
  getSettings,
  getWebhookSecret,
  SECRET_PLACEHOLDER,
  updateSettings,
  type AppSettings,
} from '@app/server/settings';

export const dynamic = 'force-dynamic';

function publicSettings(s: AppSettings) {
  return {
    appTitle: s.appTitle,
    appUrl: s.appUrl,
    initialized: s.initialized,
    bubblarrUrl: s.bubblarrUrl,
    bubblarrApiKey: s.bubblarrApiKey ? SECRET_PLACEHOLDER : '',
    bubblarrRootFolderId: s.bubblarrRootFolderId,
    kavitaUrl: s.kavitaUrl,
    kavitaApiKey: s.kavitaApiKey ? SECRET_PLACEHOLDER : '',
    komgaUrl: s.komgaUrl,
    mediaServerLogin: s.mediaServerLogin,
    mediaServerCreateUsers: s.mediaServerCreateUsers,
    webhookSecret: s.initialized || s.bubblarrUrl ? getWebhookSecret() : '',
    defaultPermissions: s.defaultPermissions,
    defaultPublishers: s.defaultPublishers,
    lastSync: s.lastSync,
    lastSyncError: s.lastSyncError,
  };
}

const url = z
  .string()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\/[^\s]+$/.test(v.trim()), 'must start with http:// or https://');

const schema = z.object({
  appTitle: z.string().min(1).max(60).optional(),
  appUrl: url.optional(),
  bubblarrUrl: url.optional(),
  bubblarrApiKey: z.string().max(200).optional(),
  bubblarrRootFolderId: z.number().int().positive().nullable().optional(),
  kavitaUrl: url.optional(),
  kavitaApiKey: z.string().max(200).optional(),
  komgaUrl: url.optional(),
  mediaServerLogin: z.enum(['none', 'kavita', 'komga']).optional(),
  mediaServerCreateUsers: z.boolean().optional(),
  defaultPermissions: z.number().int().min(0).optional(),
  defaultPublishers: z.array(z.enum(PUBLISHER_CHOICES as [string, ...string[]])).min(1).optional(),
});

export const GET = handler(async () => {
  await requireUser(Permission.MANAGE_SETTINGS);
  return json(publicSettings(getSettings()));
});

export const PUT = handler(async (request: Request) => {
  await requireUser(Permission.MANAGE_SETTINGS);
  const data = await parseBody(request, schema);
  const current = getSettings();

  const values: Partial<AppSettings> = { ...data };
  // The placeholder means "keep the current secret"
  for (const key of ['bubblarrApiKey', 'kavitaApiKey'] as const) {
    if (values[key] === SECRET_PLACEHOLDER) {
      delete values[key];
    } else if (values[key] !== undefined) {
      values[key] = values[key]!.trim();
    }
  }
  for (const key of ['appUrl', 'bubblarrUrl', 'kavitaUrl', 'komgaUrl'] as const) {
    if (values[key] !== undefined) {
      values[key] = normaliseUrl(values[key]!);
    }
  }
  if (values.defaultPublishers !== undefined) {
    values.defaultPublishers = cleanPublisherChoice(values.defaultPublishers) ?? undefined;
  }
  // Nobody can be given Admin by default
  if (values.defaultPermissions !== undefined) {
    values.defaultPermissions &= ~Permission.ADMIN;
  }
  if (
    values.kavitaUrl !== undefined && values.kavitaUrl !== current.kavitaUrl
  ) {
    clearKavitaLinks();
  }

  return json(publicSettings(updateSettings(values)));
});
