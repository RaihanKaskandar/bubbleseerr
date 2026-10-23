import { describe, expect, it } from 'vitest';

import { hasPermission, Permission } from '@app/lib/permissions';
import { canRequest, displayStatus } from '@app/lib/status';

describe('hasPermission', () => {
  it('gives admins everything', () => {
    expect(hasPermission(Permission.MANAGE_USERS, Permission.ADMIN)).toBe(true);
  });
  it('needs all permissions by default', () => {
    const value = Permission.REQUEST | Permission.REQUEST_VIEW;
    expect(hasPermission([Permission.REQUEST, Permission.REQUEST_VIEW], value)).toBe(true);
    expect(hasPermission([Permission.REQUEST, Permission.MANAGE_USERS], value)).toBe(false);
  });
  it('needs one with "or"', () => {
    expect(hasPermission([Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW], Permission.REQUEST_VIEW, { type: 'or' })).toBe(true);
    expect(hasPermission([Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW], Permission.REQUEST, { type: 'or' })).toBe(false);
  });
});

describe('displayStatus', () => {
  it('prefers what is in the library', () => {
    expect(displayStatus('available', 'failed')).toBe('available');
    expect(displayStatus('downloading', 'processing')).toBe('downloading');
    expect(displayStatus('wanted', 'processing')).toBe('processing');
    expect(displayStatus('wanted', 'failed')).toBe('failed');
  });
  it('falls back to the request', () => {
    expect(displayStatus('not_added', null)).toBe('none');
    expect(displayStatus('unmonitored', 'processing')).toBe('processing');
  });
  it('knows what can still be requested', () => {
    expect(canRequest('none')).toBe(true);
    expect(canRequest('partially_available')).toBe(true);
    expect(canRequest('processing')).toBe(false);
    expect(canRequest('available')).toBe(false);
  });
});

describe('TtlCache', async () => {
  const { TtlCache } = await import('@app/server/cache');
  it('runs a computation only once at a time', async () => {
    const cache = new TtlCache<number>(1000);
    let calls = 0;
    const compute = () => new Promise<number>((resolve) => setTimeout(() => resolve(++calls), 10));
    const results = await Promise.all([cache.getOrSet('a', compute), cache.getOrSet('a', compute)]);
    expect(results).toEqual([1, 1]);
    expect(await cache.getOrSet('a', compute)).toBe(1);
  });
});

describe('English publishers', async () => {
  const { isEnglishPublisher } = await import('@app/server/discover');
  it('leaves out Japanese and French publishers, also with accents', () => {
    for (const p of ['Shueisha', 'Shōnen Gahōsha', 'Leed Publishing Co., Ltd.', 'Futabasha Publishers Ltd.', 'Kodansha', 'Dupuis', "Vents d'Ouest"]) {
      expect(isEnglishPublisher(p)).toBe(false);
    }
    for (const p of ['DC Comics', 'Marvel', 'Kodansha Comics USA', 'Titan Comics', 'Ignition Press', null]) {
      expect(isEnglishPublisher(p)).toBe(true);
    }
  });
});
