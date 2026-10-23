import { z } from 'zod';

import { Permission } from '@app/lib/permissions';
import { bubblarr, BubblarrError } from '@app/server/bubblarr';
import { handler, json, parseBody, requireUser } from '@app/server/http';
import { getSettings, SECRET_PLACEHOLDER } from '@app/server/settings';

const schema = z.object({
  url: z.string().min(1).max(500),
  apiKey: z.string().max(200),
});

/** Test a Bubblarr connection; returns its root folders */
export const POST = handler(async (request: Request) => {
  await requireUser(Permission.MANAGE_SETTINGS);
  const data = await parseBody(request, schema);
  const apiKey =
    data.apiKey === SECRET_PLACEHOLDER ? getSettings().bubblarrApiKey : data.apiKey.trim();
  try {
    const rootFolders = await bubblarr.test({ url: data.url, apiKey });
    return json({ success: true, rootFolders });
  } catch (e) {
    return json({
      success: false,
      message: e instanceof BubblarrError ? e.message : "Couldn't connect to Bubblarr",
    });
  }
});
