import { z } from 'zod';

import { Permission } from '@app/lib/permissions';
import { cleanPublisherChoice, PUBLISHER_CHOICES } from '@app/lib/publishers';
import {
  NO_PASSWORD,
  toPublicUser,
  userHasPermission,
  verifyPassword,
} from '@app/server/auth';
import {
  ApiError,
  getSessionToken,
  handler,
  idParam,
  json,
  parseBody,
  requireUser,
} from '@app/server/http';
import {
  deleteUser,
  getUser,
  optionalEmail,
  updateUser,
} from '@app/server/users';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  email: optionalEmail,
  username: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[\w.-]+$/, 'only letters, numbers, . - and _')
    .optional(),
  displayName: z.string().max(100).optional(),
  /** null removes the password */
  password: z.string().max(500).nullable().optional(),
  /** Needed when changing or removing your own password */
  currentPassword: z.string().max(500).optional(),
  permissions: z.number().int().min(0).optional(),
  publishers: z
    .array(z.enum(PUBLISHER_CHOICES as [string, ...string[]]))
    .min(1, 'choose at least one publisher')
    .nullable()
    .optional(),
});

export const GET = handler(async (_request: Request, { params }: Params) => {
  const actor = await requireUser();
  const id = idParam.parse((await params).id);
  if (actor.id !== id && !userHasPermission(actor, Permission.MANAGE_USERS)) {
    throw new ApiError(403, "You can't see other users", 'forbidden');
  }
  const user = getUser(id);
  if (!user) {
    throw new ApiError(404, 'User not found', 'not_found');
  }
  return json(toPublicUser(user));
});

export const PUT = handler(async (request: Request, { params }: Params) => {
  const actor = await requireUser();
  const id = idParam.parse((await params).id);
  const data = await parseBody(request, schema);

  // Accounts of a media server have no password here; updateUser says so
  const changesPassword = data.password === null || !!data.password;
  if (changesPassword && actor.id === id && actor.authSource === 'local' && actor.passwordHash !== NO_PASSWORD) {
    if (
      !data.currentPassword ||
      !(await verifyPassword(data.currentPassword, actor.passwordHash))
    ) {
      throw new ApiError(400, 'Your current password is wrong', 'wrong_password');
    }
  }
  const user = await updateUser(
    actor,
    id,
    { ...data, publishers: data.publishers === undefined ? undefined : cleanPublisherChoice(data.publishers) },
    await getSessionToken()
  );
  return json(user);
});

export const DELETE = handler(async (_request: Request, { params }: Params) => {
  const actor = await requireUser(Permission.MANAGE_USERS);
  deleteUser(actor, idParam.parse((await params).id));
  return json({ success: true });
});
