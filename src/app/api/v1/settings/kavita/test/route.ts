import { z } from 'zod';

import { Permission } from '@app/lib/permissions';
import { handler, json, parseBody, requireUser } from '@app/server/http';
import { KavitaError, testKavita } from '@app/server/kavita';
import { getSettings, SECRET_PLACEHOLDER } from '@app/server/settings';

const schema = z.object({
  url: z.string().min(1).max(500),
  apiKey: z.string().max(200),
});

export const POST = handler(async (request: Request) => {
  await requireUser(Permission.MANAGE_SETTINGS);
  const data = await parseBody(request, schema);
  const apiKey =
    data.apiKey === SECRET_PLACEHOLDER ? getSettings().kavitaApiKey : data.apiKey.trim();
  try {
    await testKavita(data.url, apiKey);
    return json({ success: true });
  } catch (e) {
    return json({
      success: false,
      message: e instanceof KavitaError ? e.message : "Couldn't connect to Kavita",
    });
  }
});
