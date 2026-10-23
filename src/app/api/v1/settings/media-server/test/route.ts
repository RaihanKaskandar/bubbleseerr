import { z } from 'zod';

import { Permission } from '@app/lib/permissions';
import { handler, json, parseBody, requireUser } from '@app/server/http';
import { MediaLoginError, testMediaServer } from '@app/server/media-login';

const schema = z.object({
  server: z.enum(['kavita', 'komga']),
  url: z.string().min(1).max(500),
});

export const POST = handler(async (request: Request) => {
  await requireUser(Permission.MANAGE_SETTINGS);
  const { server, url } = await parseBody(request, schema);
  try {
    await testMediaServer(server, url);
    return json({ success: true });
  } catch (e) {
    return json({
      success: false,
      message: e instanceof MediaLoginError ? e.message : "Couldn't connect",
    });
  }
});
