import { and, asc, eq, or, sql } from 'drizzle-orm';

import { hasPermission, Permission } from '@app/lib/permissions';
import {
  checkLogin,
  deleteSessionsOfUser,
  findUserByLogin,
  hashPassword,
  NO_PASSWORD,
  parsePublishers,
  toPublicUser,
  userHasPermission,
  type PublicUser,
} from '@app/server/auth';
import { getDb } from '@app/server/db';
import { requests, users, type User } from '@app/server/db/schema';
import { ApiError } from '@app/server/http';
import {
  MEDIA_SERVER_NAMES,
  mediaLogin,
  mediaLoginServer,
  type MediaAccount,
} from '@app/server/media-login';
import { getSettings } from '@app/server/settings';

export const MIN_PASSWORD_LENGTH = 8;

export function countUsers(): number {
  return (
    getDb().select({ count: sql<number>`count(*)` }).from(users).get()?.count ??
    0
  );
}

/** The publishers a user sees: their own choice, or the default */
export function effectivePublishers(user: Pick<User, 'publishers'>): string[] {
  return parsePublishers(user.publishers) ?? getSettings().defaultPublishers;
}

export function getUser(id: number): User | undefined {
  return getDb().select().from(users).where(eq(users.id, id)).get();
}

export function listUsers(): (PublicUser & { requestCount: number; owner: boolean })[] {
  const db = getDb();
  const counts = new Map(
    db
      .select({ userId: requests.requestedBy, count: sql<number>`count(*)` })
      .from(requests)
      .groupBy(requests.requestedBy)
      .all()
      .map((r) => [r.userId, r.count])
  );
  const ownerId = firstAdminId();
  return db
    .select()
    .from(users)
    .orderBy(asc(users.createdAt))
    .all()
    .map((u) => ({ ...toPublicUser(u), requestCount: counts.get(u.id) ?? 0, owner: u.id === ownerId }));
}

function assertUnique(email: string, username: string, exceptId?: number) {
  const existing = getDb()
    .select({ id: users.id, email: users.email, username: users.username })
    .from(users)
    .where(or(eq(users.email, email), eq(users.username, username)))
    .all()
    .filter((u) => u.id !== exceptId);
  if (existing.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new ApiError(409, 'A user with this email already exists', 'email_taken');
  }
  if (existing.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new ApiError(409, 'This username is already taken', 'username_taken');
  }
}

/**
 * Only admins may give (or take away) the Admin permission, and only admins
 * may change other admins.
 */
function assertMayChangePermissions(
  actor: User,
  target: User | null,
  newPermissions: number
) {
  const actorIsAdmin = hasPermission(Permission.ADMIN, actor.permissions);
  if (actorIsAdmin) {
    return;
  }
  if (target && hasPermission(Permission.ADMIN, target.permissions)) {
    throw new ApiError(403, "Only admins can change admins", 'forbidden');
  }
  if (newPermissions & Permission.ADMIN) {
    throw new ApiError(
      403,
      'Only admins can give the Admin permission',
      'forbidden'
    );
  }
}

export async function createUser(
  actor: User | null,
  data: {
    email: string;
    username: string;
    displayName?: string;
    /** Not needed for accounts of a media server */
    password: string;
    permissions: number;
    publishers?: string[] | null;
    account?: MediaAccount;
  }
): Promise<PublicUser> {
  if (actor) {
    assertMayChangePermissions(actor, null, data.permissions);
  }
  const email = data.email.trim();
  const username = data.username.trim();
  assertUnique(email, username);

  const user = getDb()
    .insert(users)
    .values({
      email,
      username,
      displayName: data.displayName?.trim() || username,
      passwordHash: data.account ? NO_PASSWORD : await hashPassword(data.password),
      authSource: data.account?.server ?? 'local',
      externalId: data.account?.externalId ?? null,
      permissions: data.permissions,
      publishers: data.publishers ? JSON.stringify(data.publishers) : null,
      createdAt: Date.now(),
    })
    .returning()
    .get();
  return toPublicUser(user);
}

export async function updateUser(
  actor: User,
  id: number,
  data: {
    email?: string;
    username?: string;
    displayName?: string;
    password?: string;
    permissions?: number;
    /** null = go back to the default */
    publishers?: string[] | null;
  },
  /** The session to keep when the password changes (the actor's own) */
  keepSessionToken?: string
): Promise<PublicUser> {
  const target = getUser(id);
  if (!target) {
    throw new ApiError(404, 'User not found', 'not_found');
  }
  const isSelf = actor.id === target.id;
  if (!isSelf && !userHasPermission(actor, Permission.MANAGE_USERS)) {
    throw new ApiError(403, "You can't change other users", 'forbidden');
  }

  const values: Partial<User> = {};
  if (data.permissions !== undefined && data.permissions !== target.permissions) {
    if (isSelf) {
      throw new ApiError(403, "You can't change your own permissions", 'forbidden');
    }
    assertMayChangePermissions(actor, target, data.permissions);
    if (target.id === firstAdminId() && !(data.permissions & Permission.ADMIN)) {
      throw new ApiError(400, "The owner account must stay admin", 'forbidden');
    }
    values.permissions = data.permissions;
  }
  if (!isSelf && !hasPermission(Permission.ADMIN, actor.permissions)
      && hasPermission(Permission.ADMIN, target.permissions)) {
    throw new ApiError(403, 'Only admins can change admins', 'forbidden');
  }

  const email = data.email?.trim() ?? target.email;
  const username = data.username?.trim() ?? target.username;
  if (email !== target.email || username !== target.username) {
    assertUnique(email, username, target.id);
    values.email = email;
    values.username = username;
  }
  if (data.displayName !== undefined) {
    values.displayName = data.displayName.trim() || username;
  }
  if (data.publishers !== undefined) {
    values.publishers = data.publishers ? JSON.stringify(data.publishers) : null;
  }
  if (data.password && target.authSource !== 'local') {
    throw new ApiError(
      400,
      `This account signs in with ${MEDIA_SERVER_NAMES[target.authSource as 'kavita'] ?? target.authSource}; change the password there`,
      'external_account'
    );
  }
  if (data.password) {
    values.passwordHash = await hashPassword(data.password);
  }

  const updated = Object.keys(values).length
    ? getDb().update(users).set(values).where(eq(users.id, id)).returning().get()
    : target;

  if (data.password) {
    // Log the user out on other devices
    deleteSessionsOfUser(id, isSelf ? keepSessionToken : undefined);
  }
  return toPublicUser(updated);
}

export function deleteUser(actor: User, id: number): void {
  const target = getUser(id);
  if (!target) {
    throw new ApiError(404, 'User not found', 'not_found');
  }
  if (actor.id === target.id) {
    throw new ApiError(400, "You can't delete yourself", 'forbidden');
  }
  if (target.id === firstAdminId()) {
    throw new ApiError(400, "The owner account can't be deleted", 'forbidden');
  }
  assertMayChangePermissions(actor, target, 0);
  getDb().delete(users).where(eq(users.id, id)).run();
}

/** The account created during setup; it can't be deleted or demoted */
export function firstAdminId(): number | undefined {
  return getDb()
    .select({ id: users.id })
    .from(users)
    .orderBy(asc(users.id))
    .limit(1)
    .get()?.id;
}

// region Media server sign-in
/** A free username based on the media server's one */
function freeUsername(name: string): string {
  const base = name.replace(/[^\w.-]/g, '').slice(0, 40) || 'user';
  for (let i = 1; ; i++) {
    const candidate = i === 1 ? base : `${base}${i}`;
    const taken = getDb()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate))
      .get();
    if (!taken) {
      return candidate;
    }
  }
}

/**
 * Sign in with a Bubbleseerr password, or with the Kavita/Komga account when
 * that is turned on. The first sign-in with such an account creates the
 * Bubbleseerr account (with the default permissions), unless that is turned
 * off. Returns null for a wrong login.
 */
export async function authenticate(login: string, password: string): Promise<User | null> {
  const existing = findUserByLogin(login);
  if (!existing || existing.authSource === 'local') {
    const user = await checkLogin(login, password);
    if (user || existing) {
      // A local account wins; its password is checked here, not elsewhere
      return user;
    }
  }

  const media = mediaLoginServer();
  if (!media || (existing && existing.authSource !== media.server)) {
    return null;
  }
  let account: MediaAccount | null;
  try {
    account = await mediaLogin(media.server, media.url, login.trim(), password);
  } catch (e) {
    throw new ApiError(502, e instanceof Error ? e.message : 'The media server failed', 'media_server_error');
  }
  if (!account) {
    return null;
  }

  const linked = getDb()
    .select()
    .from(users)
    .where(and(eq(users.authSource, account.server), eq(users.externalId, account.externalId)))
    .get();
  if (linked) {
    return linked;
  }

  const settings = getSettings();
  const serverName = MEDIA_SERVER_NAMES[account.server];
  if (!settings.mediaServerCreateUsers) {
    throw new ApiError(
      403,
      `Your ${serverName} account has no access here yet. Ask the admin to let you in.`,
      'no_access'
    );
  }
  let email = account.email ?? `${account.externalId}@${account.server}.invalid`;
  const emailTaken = getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  if (emailTaken) {
    // Never take over another account by its email address
    email = `${account.externalId}@${account.server}.invalid`;
  }
  const created = await createUser(null, {
    email,
    username: freeUsername(account.username),
    displayName: account.username,
    password: '',
    permissions: settings.defaultPermissions,
    account,
  });
  return getUser(created.id) ?? null;
}
