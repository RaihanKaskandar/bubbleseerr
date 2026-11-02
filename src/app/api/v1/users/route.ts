import { z } from 'zod';

import { Permission } from '@app/lib/permissions';
import { cleanPublisherChoice, PUBLISHER_CHOICES } from '@app/lib/publishers';
import { handler, json, parseBody, requireUser } from '@app/server/http';
import { getSettings } from '@app/server/settings';
import { createUser, listUsers, optionalEmail } from '@app/server/users';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: optionalEmail,
  username: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[\w.-]+$/, 'only letters, numbers, . - and _'),
  displayName: z.string().max(100).optional(),
  password: z.string().max(500).optional(),
  permissions: z.number().int().min(0).optional(),
  publishers: z
    .array(z.enum(PUBLISHER_CHOICES as [string, ...string[]]))
    .min(1, 'choose at least one publisher')
    .nullable()
    .optional(),
});

export const GET = handler(async () => {
  await requireUser(Permission.MANAGE_USERS);
  return json(listUsers());
});

export const POST = handler(async (request: Request) => {
  const actor = await requireUser(Permission.MANAGE_USERS);
  const data = await parseBody(request, schema);
  const user = await createUser(actor, {
    ...data,
    permissions: data.permissions ?? getSettings().defaultPermissions,
    publishers: cleanPublisherChoice(data.publishers),
  });
  return json(user, 201);
});
