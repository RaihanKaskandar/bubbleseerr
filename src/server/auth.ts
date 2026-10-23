import { createHash, randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';
import { and, eq, gt, lt, or } from 'drizzle-orm';

import { hasPermission, Permission } from '@app/lib/permissions';
import { cleanPublisherChoice } from '@app/lib/publishers';
import { getDb } from '@app/server/db';
import { sessions, users, type User } from '@app/server/db/schema';

export const SESSION_COOKIE = 'bubbleseerr_session';
/** Sessions last 30 days and are extended while the user is active */
export const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;
const SESSION_RENEW_AFTER = 24 * 60 * 60 * 1000;

export type PublicUser = Omit<User, 'passwordHash' | 'publishers'> & {
  /** The user's own publisher choice; null = the default */
  publishers: string[] | null;
};

export function parsePublishers(value: string | null): string[] | null {
  try {
    return cleanPublisherChoice(value ? JSON.parse(value) : null);
  } catch {
    return null;
  }
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, publishers, ...rest } = user;
  return { ...rest, publishers: parsePublishers(publishers) };
}

// region Passwords
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Accounts that sign in with a media server have no password here */
export const NO_PASSWORD = '!';

// A hash to compare against when the user doesn't exist, so that logging in
// takes as long whether or not the account exists
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

// region Sessions
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSession(userId: number): {
  token: string;
  expiresAt: number;
} {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION;
  getDb()
    .insert(sessions)
    .values({ idHash: hashToken(token), userId, expiresAt, createdAt: now })
    .run();
  return { token, expiresAt };
}

/**
 * Get the user that a session token belongs to. Extends sessions that are
 * still in use.
 */
export function getUserBySessionToken(token: string | undefined): User | null {
  if (!token) {
    return null;
  }
  const db = getDb();
  const idHash = hashToken(token);
  const now = Date.now();
  const row = db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.idHash, idHash), gt(sessions.expiresAt, now)))
    .get();
  if (!row) {
    return null;
  }

  if (row.expiresAt - now < SESSION_DURATION - SESSION_RENEW_AFTER) {
    db.update(sessions)
      .set({ expiresAt: now + SESSION_DURATION })
      .where(eq(sessions.idHash, idHash))
      .run();
  }
  return row.user;
}

export function deleteSession(token: string | undefined): void {
  if (token) {
    getDb()
      .delete(sessions)
      .where(eq(sessions.idHash, hashToken(token)))
      .run();
  }
}

/** Log a user out everywhere, e.g. after their password changed */
export function deleteSessionsOfUser(userId: number, exceptToken?: string) {
  const db = getDb();
  const all = db
    .select({ idHash: sessions.idHash })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .all();
  const keep = exceptToken ? hashToken(exceptToken) : null;
  for (const s of all) {
    if (s.idHash !== keep) {
      db.delete(sessions).where(eq(sessions.idHash, s.idHash)).run();
    }
  }
}

export function deleteExpiredSessions(): void {
  getDb().delete(sessions).where(lt(sessions.expiresAt, Date.now())).run();
}

// region Login
export function findUserByLogin(login: string): User | undefined {
  return getDb()
    .select()
    .from(users)
    .where(or(eq(users.email, login.trim()), eq(users.username, login.trim())))
    .get();
}

/** Check the password of a local account */
export async function checkLogin(
  login: string,
  password: string
): Promise<User | null> {
  const user = findUserByLogin(login);
  if (!user || user.authSource !== 'local') {
    await verifyPassword(password, DUMMY_HASH);
    return null;
  }
  return (await verifyPassword(password, user.passwordHash)) ? user : null;
}

/**
 * A simple limit on failed logins per IP address: 10 failures per 15 minutes.
 */
const FAILED_LOGIN_WINDOW = 15 * 60 * 1000;
const MAX_FAILED_LOGINS = 10;
const failedLogins = new Map<string, number[]>();

export function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempts = (failedLogins.get(ip) ?? []).filter(
    (t) => now - t < FAILED_LOGIN_WINDOW
  );
  failedLogins.set(ip, attempts);
  return attempts.length >= MAX_FAILED_LOGINS;
}

export function recordFailedLogin(ip: string): void {
  const attempts = failedLogins.get(ip) ?? [];
  attempts.push(Date.now());
  failedLogins.set(ip, attempts);
}

export function clearFailedLogins(ip: string): void {
  failedLogins.delete(ip);
}

// region Checks
export function userHasPermission(
  user: Pick<User, 'permissions'> | null,
  permission: Permission | Permission[],
  type: 'and' | 'or' = 'and'
): boolean {
  return !!user && hasPermission(permission, user.permissions, { type });
}
