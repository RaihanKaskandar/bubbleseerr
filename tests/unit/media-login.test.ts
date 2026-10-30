import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Permission } from '@app/lib/permissions';
import { updateSettings } from '@app/server/settings';
import { authenticate, createUser, getUser, linkKavita, unlinkKavita, updateUser } from '@app/server/users';

import { useTestDb } from './helpers';

/** A pretend Kavita with one account, and a Komga with one account */
function fakeServers() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === 'http://kavita:5000/api/Account/login') {
      const body = JSON.parse(String(init?.body));
      if (body.username.toLowerCase() === 'alice' && body.password === 'kavita-pass') {
        return new Response(JSON.stringify({ id: 7, username: 'Alice', email: 'alice@mail.test', token: 'jwt' }));
      }
      return new Response('Your credentials are not correct', { status: 401 });
    }
    if (url === 'http://komga:25600/api/v2/users/me') {
      const auth = new Headers(init?.headers).get('Authorization');
      if (auth === `Basic ${Buffer.from('bob@mail.test:komga-pass').toString('base64')}`) {
        return new Response(JSON.stringify({ id: '0ABC', email: 'bob@mail.test', roles: ['ADMIN'] }));
      }
      return new Response('', { status: 401 });
    }
    throw new Error(`unexpected ${url}`);
  });
}

let fetchMock: ReturnType<typeof fakeServers>;

beforeEach(async () => {
  useTestDb();
  fetchMock = fakeServers();
  vi.stubGlobal('fetch', fetchMock);
  updateSettings({ kavitaUrl: 'http://kavita:5000', komgaUrl: 'http://komga:25600', defaultPermissions: Permission.REQUEST });
  await createUser(null, { email: 'owner@x.nl', username: 'owner', password: 'password1', permissions: Permission.ADMIN });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signing in with Kavita', () => {
  beforeEach(() => {
    updateSettings({ mediaServerLogin: 'kavita' });
  });

  it('creates the account on the first sign-in and reuses it after', async () => {
    const user = await authenticate('alice', 'kavita-pass');
    expect(user).toMatchObject({ username: 'Alice', email: 'alice@mail.test', authSource: 'kavita', externalId: '7', permissions: Permission.REQUEST });
    expect(user!.passwordHash).toBe('!');

    const again = await authenticate('Alice', 'kavita-pass');
    expect(again!.id).toBe(user!.id);
    expect(await authenticate('alice', 'wrong')).toBeNull();
  });

  it('checks local accounts locally and never asks Kavita for them', async () => {
    expect((await authenticate('owner', 'password1'))?.username).toBe('owner');
    expect(await authenticate('owner', 'kavita-pass')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only lets known users in when creating accounts is off', async () => {
    updateSettings({ mediaServerCreateUsers: false });
    await expect(authenticate('alice', 'kavita-pass')).rejects.toThrow(/no access/);
  });

  it("doesn't take over an account with the same email", async () => {
    const owner = getUser(1)!;
    await updateUser(owner, owner.id, { email: 'alice@mail.test' });
    const user = await authenticate('alice', 'kavita-pass');
    expect(user!.id).not.toBe(owner.id);
    expect(user!.email).toBe('7@kavita.invalid');
  });

  it("doesn't set passwords on Kavita accounts", async () => {
    const user = await authenticate('alice', 'kavita-pass');
    await expect(updateUser(user!, user!.id, { password: 'something-new' })).rejects.toThrow(/Kavita/);
  });

  it('is off unless turned on', async () => {
    updateSettings({ mediaServerLogin: 'none' });
    expect(await authenticate('alice', 'kavita-pass')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('signing in with Komga', () => {
  it('uses the email address and keeps the Komga ID', async () => {
    updateSettings({ mediaServerLogin: 'komga' });
    const user = await authenticate('bob@mail.test', 'komga-pass');
    expect(user).toMatchObject({ username: 'bob', authSource: 'komga', externalId: '0ABC' });
    // Not an admin here just because it's one in Komga
    expect(user!.permissions).toBe(Permission.REQUEST);
    expect((await authenticate('bob@mail.test', 'komga-pass'))!.id).toBe(user!.id);
    expect(await authenticate('bob@mail.test', 'nope')).toBeNull();
  });
});

describe('connecting a local account to Kavita', () => {
  beforeEach(() => {
    updateSettings({ mediaServerLogin: 'kavita' });
  });

  it('links after Kavita accepts the login, and then signs in with Kavita', async () => {
    const owner = (await authenticate('owner', 'password1'))!;
    await expect(linkKavita(owner, 'alice', 'wrong')).rejects.toMatchObject({ status: 401 });

    const linked = await linkKavita(owner, 'alice', 'kavita-pass');
    expect(linked.kavitaLinkId).toBe('7');

    // The Kavita login opens the local account, no second account is made
    expect((await authenticate('alice', 'kavita-pass'))!.id).toBe(owner.id);
    expect((await authenticate('owner', 'password1'))!.id).toBe(owner.id);

    expect(unlinkKavita(owner).kavitaLinkId).toBeNull();
  });

  it('refuses a Kavita account that another user already has', async () => {
    const owner = (await authenticate('owner', 'password1'))!;
    await linkKavita(owner, 'alice', 'kavita-pass');
    const other = await createUser(null, { email: 'o@x.nl', username: 'other', password: 'password1', permissions: Permission.REQUEST });
    await expect(linkKavita(getUser(other.id)!, 'alice', 'kavita-pass')).rejects.toMatchObject({ status: 409 });
  });
});
