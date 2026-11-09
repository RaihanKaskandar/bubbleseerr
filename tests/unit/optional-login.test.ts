import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Permission } from '@app/lib/permissions';
import { checkLogin, NO_PASSWORD, toPublicUser } from '@app/server/auth';
import { openDatabase } from '@app/server/db';
import { updateSettings } from '@app/server/settings';
import { authenticate, createUser, getUser, updateUser } from '@app/server/users';

import { useTestDb } from './helpers';

beforeEach(() => {
  useTestDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function owner() {
  return getUser((await createUser(null, { username: 'owner', password: 'password1', permissions: Permission.ADMIN })).id)!;
}

describe('accounts without an email address', () => {
  it('lets several users have none', async () => {
    const a = await createUser(null, { username: 'a', permissions: 0 });
    const b = await createUser(null, { email: '', username: 'b', permissions: 0 });
    const c = await createUser(null, { email: '  ', username: 'c', permissions: 0 });
    expect([a.email, b.email, c.email]).toEqual([null, null, null]);
  });

  it('still keeps the addresses that are given unique', async () => {
    await createUser(null, { email: 'a@x.nl', username: 'a', permissions: 0 });
    await expect(createUser(null, { email: 'A@x.nl', username: 'b', permissions: 0 })).rejects.toThrow(/email/);
  });

  it('can remove an address', async () => {
    const actor = await owner();
    const user = await createUser(actor, { email: 'a@x.nl', username: 'a', permissions: 0 });
    expect((await updateUser(actor, user.id, { email: '' })).email).toBeNull();
    expect((await updateUser(actor, user.id, { email: 'b@x.nl' })).email).toBe('b@x.nl');
    expect((await updateUser(actor, user.id, { email: null })).email).toBeNull();
  });

  it('keeps the address when the update has none', async () => {
    const actor = await owner();
    const user = await createUser(actor, { email: 'a@x.nl', username: 'a', permissions: 0 });
    expect((await updateUser(actor, user.id, { displayName: 'A' })).email).toBe('a@x.nl');
  });

  it("doesn't sign in with an empty login", async () => {
    await createUser(null, { username: 'a', permissions: 0 });
    expect(await checkLogin('', '')).toBeNull();
    expect(await checkLogin('  ', '')).toBeNull();
  });
});

describe('accounts without a password', () => {
  it('sign in with just the username', async () => {
    const user = await createUser(null, { username: 'kid', permissions: 0 });
    expect(user.hasPassword).toBe(false);
    expect((await checkLogin('kid', ''))?.id).toBe(user.id);
    expect((await authenticate('KID', ''))?.id).toBe(user.id);
  });

  it('accept any password, as there is none to get wrong', async () => {
    await createUser(null, { username: 'kid', permissions: 0 });
    expect(await checkLogin('kid', 'old password')).not.toBeNull();
  });

  it("don't change accounts that do have a password", async () => {
    const user = await createUser(null, { username: 'a', password: 'x', permissions: 0 });
    expect(user.hasPassword).toBe(true);
    expect(await checkLogin('a', '')).toBeNull();
    expect(await checkLogin('a', 'wrong')).toBeNull();
    expect(await authenticate('a', '')).toBeNull();
    expect(await checkLogin('a', 'x')).not.toBeNull();
  });

  it('can be set and removed', async () => {
    const actor = await owner();
    const { id } = await createUser(actor, { username: 'a', permissions: 0 });

    await updateUser(actor, id, { password: 'short' });
    expect(await checkLogin('a', '')).toBeNull();
    expect(await checkLogin('a', 'short')).not.toBeNull();

    expect((await updateUser(actor, id, { password: null })).hasPassword).toBe(false);
    expect(getUser(id)!.passwordHash).toBe(NO_PASSWORD);
    expect(await checkLogin('a', '')).not.toBeNull();
  });

  it('keep the password when the form leaves it empty', async () => {
    const actor = await owner();
    const { id } = await createUser(actor, { username: 'a', password: 'x', permissions: 0 });
    await updateUser(actor, id, { password: '', displayName: 'A' });
    expect(await checkLogin('a', 'x')).not.toBeNull();
    expect(await checkLogin('a', '')).toBeNull();
  });

  it("don't send the hash to the browser", async () => {
    const user = getUser((await createUser(null, { username: 'a', password: 'x', permissions: 0 })).id)!;
    expect(JSON.stringify(toPublicUser(user))).not.toContain(user.passwordHash);
  });
});

describe('media server accounts', () => {
  beforeEach(() => {
    updateSettings({ kavitaUrl: 'http://kavita:5000', mediaServerLogin: 'kavita', defaultPermissions: Permission.REQUEST });
  });

  function kavitaAcceptsAnything() {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 7, username: 'Alice', email: null })));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('never sign in without a password', async () => {
    const fetchMock = kavitaAcceptsAnything();
    const alice = await authenticate('alice', 'kavita-pass');
    expect(alice?.authSource).toBe('kavita');
    expect(alice?.passwordHash).toBe(NO_PASSWORD);
    fetchMock.mockClear();

    expect(await authenticate('alice', '')).toBeNull();
    expect(await checkLogin('alice', '')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("don't ask the media server about empty passwords for unknown names", async () => {
    const fetchMock = kavitaAcceptsAnything();
    expect(await authenticate('nobody', '')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("can't have their password removed here", async () => {
    kavitaAcceptsAnything();
    const alice = (await authenticate('alice', 'kavita-pass'))!;
    await expect(updateUser(alice, alice.id, { password: null })).rejects.toThrow(/Kavita/);
  });
});

describe('the migration to optional email addresses', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bubbleseerr-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** A database as it was before this migration, with the data of two users */
  function oldDatabase() {
    const file = join(dir, 'test.db');
    const { sqlite } = openDatabase(file);
    sqlite.pragma('foreign_keys = OFF');
    sqlite.exec(`
      DROP TABLE IF EXISTS reading_sync;
      DROP TABLE users;
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        permissions INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        publishers TEXT,
        auth_source TEXT NOT NULL DEFAULT 'local',
        external_id TEXT,
        kavita_link_id TEXT
      );
      INSERT INTO users (id, email, username, display_name, password_hash, permissions, created_at, publishers, auth_source, external_id, kavita_link_id)
      VALUES
        (1, 'owner@x.nl', 'owner', 'Owner', 'hash', 2, 100, '["DC"]', 'local', NULL, '9'),
        (2, '7@kavita.invalid', 'alice', 'Alice', '!', 32, 200, NULL, 'kavita', '7', NULL);
      INSERT INTO sessions VALUES ('s1', 1, 999, 100), ('s2', 2, 999, 100);
      INSERT INTO requests (comicvine_id, title, issues_spec, issues_label, status, requested_by, created_at, updated_at)
      VALUES (5, 'Batman', '"all"', 'Whole series', 'processing', 1, 100, 100),
             (6, 'Saga', '"all"', 'Whole series', 'processing', 2, 100, 100);
      PRAGMA user_version = 5;
    `);
    sqlite.close();
    return file;
  }

  it('keeps every user, session and request', () => {
    const { sqlite } = openDatabase(oldDatabase());
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 2 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM requests').get()).toEqual({ n: 2 });
    expect(sqlite.prepare('SELECT * FROM users WHERE id = 1').get()).toEqual({
      id: 1,
      email: 'owner@x.nl',
      username: 'owner',
      display_name: 'Owner',
      password_hash: 'hash',
      permissions: 2,
      created_at: 100,
      publishers: '["DC"]',
      auth_source: 'local',
      external_id: null,
      kavita_link_id: '9',
    });
    sqlite.close();
  });

  it('removes the made-up addresses of media server accounts', () => {
    const { sqlite } = openDatabase(oldDatabase());
    expect(sqlite.prepare('SELECT email FROM users WHERE id = 2').get()).toEqual({ email: null });
    sqlite.close();
  });

  it('keeps foreign keys and the rules on the users table working', () => {
    const { sqlite } = openDatabase(oldDatabase());
    const insert = sqlite.prepare(
      "INSERT INTO users (email, username, display_name, password_hash, created_at, auth_source, external_id, kavita_link_id) VALUES (?, ?, 'X', '!', 1, ?, ?, ?)"
    );
    expect(() => insert.run('OWNER@x.nl', 'x', 'local', null, null)).toThrow(/UNIQUE/);
    expect(() => insert.run(null, 'OWNER', 'local', null, null)).toThrow(/UNIQUE/);
    expect(() => insert.run(null, 'x', 'kavita', '7', null)).toThrow(/UNIQUE/);
    expect(() => insert.run(null, 'x', 'local', null, '9')).toThrow(/UNIQUE/);

    sqlite.prepare('DELETE FROM users WHERE id = 2').run();
    expect(sqlite.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 1 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM requests').get()).toEqual({ n: 1 });
    sqlite.close();
  });

  it('is not run twice', () => {
    const file = oldDatabase();
    openDatabase(file).sqlite.close();
    const raw = new Database(file);
    raw.prepare("UPDATE users SET email = 'new@x.nl' WHERE id = 2").run();
    raw.close();
    const { sqlite } = openDatabase(file);
    expect(sqlite.prepare('SELECT email FROM users WHERE id = 2').get()).toEqual({ email: 'new@x.nl' });
    sqlite.close();
  });
});
