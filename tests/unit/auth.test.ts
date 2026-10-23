import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { Permission } from '@app/lib/permissions';
import {
  checkLogin,
  clearFailedLogins,
  createSession,
  deleteSession,
  getUserBySessionToken,
  isLoginRateLimited,
  recordFailedLogin,
} from '@app/server/auth';
import { sessions } from '@app/server/db/schema';
import { createUser, deleteUser, getUser, updateUser } from '@app/server/users';

import { useTestDb } from './helpers';

let db: ReturnType<typeof useTestDb>['db'];

beforeEach(() => {
  db = useTestDb().db;
});

async function makeUsers() {
  const owner = getUser((await createUser(null, { email: 'owner@x.nl', username: 'owner', password: 'password1', permissions: Permission.ADMIN })).id)!;
  const manager = getUser((await createUser(owner, { email: 'mgr@x.nl', username: 'mgr', password: 'password1', permissions: Permission.MANAGE_USERS | Permission.REQUEST })).id)!;
  const reader = getUser((await createUser(owner, { email: 'reader@x.nl', username: 'Reader', password: 'password1', permissions: Permission.REQUEST })).id)!;
  return { owner, manager, reader };
}

describe('login and sessions', () => {
  it('logs in with email or username, case insensitive', async () => {
    await makeUsers();
    expect((await checkLogin('reader@x.nl', 'password1'))?.username).toBe('Reader');
    expect((await checkLogin('READER', 'password1'))?.username).toBe('Reader');
    expect(await checkLogin('reader', 'wrong')).toBeNull();
    expect(await checkLogin('nobody', 'password1')).toBeNull();
  });

  it('creates, finds and deletes sessions; only hashes are stored', async () => {
    const { reader } = await makeUsers();
    const { token } = createSession(reader.id);
    expect(getUserBySessionToken(token)?.id).toBe(reader.id);
    expect(db.select().from(sessions).all().every((s) => s.idHash !== token)).toBe(true);
    deleteSession(token);
    expect(getUserBySessionToken(token)).toBeNull();
    expect(getUserBySessionToken(undefined)).toBeNull();
  });

  it('ignores expired sessions', async () => {
    const { reader } = await makeUsers();
    const { token } = createSession(reader.id);
    db.update(sessions).set({ expiresAt: Date.now() - 1000 }).where(eq(sessions.userId, reader.id)).run();
    expect(getUserBySessionToken(token)).toBeNull();
  });

  it('rate limits failed logins per IP', () => {
    for (let i = 0; i < 10; i++) recordFailedLogin('1.2.3.4');
    expect(isLoginRateLimited('1.2.3.4')).toBe(true);
    expect(isLoginRateLimited('5.6.7.8')).toBe(false);
    clearFailedLogins('1.2.3.4');
    expect(isLoginRateLimited('1.2.3.4')).toBe(false);
  });
});

describe('user management rules', () => {
  it('rejects duplicate emails and usernames', async () => {
    const { owner } = await makeUsers();
    await expect(createUser(owner, { email: 'READER@x.nl', username: 'other', password: 'password1', permissions: 0 })).rejects.toThrow(/email/);
    await expect(createUser(owner, { email: 'new@x.nl', username: 'reader', password: 'password1', permissions: 0 })).rejects.toThrow(/username/);
  });

  it('only lets admins give Admin', async () => {
    const { manager, reader } = await makeUsers();
    await expect(createUser(manager, { email: 'a@x.nl', username: 'a', password: 'password1', permissions: Permission.ADMIN })).rejects.toThrow(/Admin/);
    await expect(updateUser(manager, reader.id, { permissions: Permission.ADMIN })).rejects.toThrow(/Admin/);
    expect((await updateUser(manager, reader.id, { permissions: Permission.REQUEST | Permission.REQUEST_VIEW })).permissions)
      .toBe(Permission.REQUEST | Permission.REQUEST_VIEW);
  });

  it('protects the owner', async () => {
    const { owner, manager } = await makeUsers();
    await expect(updateUser(manager, owner.id, { displayName: 'x' })).rejects.toThrow(/admins/);
    expect(() => deleteUser(manager, owner.id)).toThrow();
    const otherAdmin = getUser((await createUser(owner, { email: 'b@x.nl', username: 'b', password: 'password1', permissions: Permission.ADMIN })).id)!;
    await expect(updateUser(otherAdmin, owner.id, { permissions: Permission.REQUEST })).rejects.toThrow(/owner/);
    expect(() => deleteUser(otherAdmin, owner.id)).toThrow(/owner/);
  });

  it("doesn't let users change their own permissions", async () => {
    const { reader } = await makeUsers();
    await expect(updateUser(reader, reader.id, { permissions: Permission.ADMIN })).rejects.toThrow(/own permissions/);
    expect((await updateUser(reader, reader.id, { displayName: 'Rea' })).displayName).toBe('Rea');
  });

  it('logs out other sessions after a password change', async () => {
    const { reader } = await makeUsers();
    const keep = createSession(reader.id).token;
    const other = createSession(reader.id).token;
    await updateUser(reader, reader.id, { password: 'newpassword' }, keep);
    expect(getUserBySessionToken(keep)?.id).toBe(reader.id);
    expect(getUserBySessionToken(other)).toBeNull();
    expect(await checkLogin('reader', 'newpassword')).not.toBeNull();
  });
});
