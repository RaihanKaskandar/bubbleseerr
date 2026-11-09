import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toPublicUser } from '@app/server/auth';
import { Permission } from '@app/lib/permissions';
import type { LocgSeries } from '@app/server/locg';
import {
  chaptersToMark,
  connectLocg,
  matchSeries,
  readingSyncStatus,
  saveKavitaKey,
  syncDueReadingLists,
  syncReadingList,
} from '@app/server/reading-sync';
import { updateSettings } from '@app/server/settings';
import { authenticate, createUser, getUser, linkKavita, unlinkKavita } from '@app/server/users';

import { useTestDb } from './helpers';

const locg = vi.hoisted(() => ({ series: [] as LocgSeries[], issues: {} as Record<number, number[]>, issueCalls: [] as number[], fail: null as Error | null }));

vi.mock('@app/server/locg', async (original) => ({
  ...(await original<typeof import('@app/server/locg')>()),
  readSeries: async () => {
    if (locg.fail) throw locg.fail;
    return locg.series;
  },
  readIssueNumbers: async (_user: number, seriesId: number) => {
    locg.issueCalls.push(seriesId);
    return locg.issues[seriesId] ?? [];
  },
}));

const chapter = (id: number, number: number, pagesRead = 0) => ({ id, minNumber: number, maxNumber: number, pages: 20, pagesRead, isSpecial: false });
const named = (id: number, name: string) => ({ id, name, originalName: name, localizedName: '' });

/** A pretend Kavita with "Batman" (series 83) and Bubblarr knowing it's the 2025 run */
function fakeServers() {
  const state = {
    chapters: [chapter(1, 1, 20), chapter(2, 2), chapter(3, 3), chapter(4, 4)],
    marked: [] as { seriesId: number; chapterIds: number[]; auth: string | null }[],
    tokens: [] as string[],
    keyWorks: true,
  };
  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/Plugin/authenticate') {
      state.tokens.push(url.searchParams.get('apiKey')!);
      return state.keyWorks ? new Response(JSON.stringify({ token: `jwt-of-${url.searchParams.get('apiKey')}` })) : new Response('', { status: 401 });
    }
    if (url.pathname === '/api/Series/all-v2') {
      return new Response(JSON.stringify([named(83, 'Batman')]));
    }
    if (url.pathname === '/api/Series/volumes') {
      return new Response(JSON.stringify([{ chapters: state.chapters }]));
    }
    if (url.pathname === '/api/Reader/mark-multiple-read') {
      const body = JSON.parse(String(init?.body));
      state.marked.push({ seriesId: body.seriesId, chapterIds: body.chapterIds, auth: new Headers(init?.headers).get('Authorization') });
      for (const c of state.chapters) {
        if (body.chapterIds.includes(c.id)) c.pagesRead = c.pages;
      }
      return new Response('');
    }
    if (url.pathname === '/api/volumes') {
      return new Response(JSON.stringify({ error: null, result: [{ id: 1, title: 'Batman', year: 2025 }] }));
    }
    if (url.pathname === '/api/Account/login') {
      const body = JSON.parse(String(init?.body));
      return body.password === 'kavita-pass'
        ? new Response(JSON.stringify({ id: 7, username: 'Alice', email: null, apiKey: 'alice-key' }))
        : new Response('', { status: 401 });
    }
    throw new Error(`unexpected ${url}`);
  });
  return { state, fetchMock };
}

let servers: ReturnType<typeof fakeServers>;
let userId: number;

beforeEach(async () => {
  useTestDb();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  servers = fakeServers();
  vi.stubGlobal('fetch', servers.fetchMock);
  updateSettings({ kavitaUrl: 'http://kavita:5000', kavitaApiKey: 'ADMIN-KEY', bubblarrUrl: 'http://bubblarr:5656', bubblarrApiKey: 'x', mediaServerLogin: 'kavita' });
  userId = (await createUser(null, { email: 'a@x.nl', username: 'alice', password: 'password1', permissions: Permission.REQUEST })).id;
  saveKavitaKey(userId, 'alice-key');
  connectLocg(userId, { userId: 26853, username: 'alice' });
  locg.series = [{ id: 500, title: 'Batman', year: 2025, publisher: 'DC Comics', count: 3 }];
  locg.issues = { 500: [1, 2, 3] };
  locg.issueCalls = [];
  locg.fail = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('matchSeries', () => {
  const volumes = [{ title: 'Batman', year: 2025 }];
  const kavita = [named(83, 'Batman')];

  it('matches the same comic', () => {
    expect(matchSeries({ title: 'Batman', year: 2025 }, volumes, kavita)).toEqual({ status: 'matched', seriesId: 83 });
    expect(matchSeries({ title: 'Batman', year: 2024 }, volumes, kavita).status).toBe('matched');
    expect(matchSeries({ title: 'Barbara Gordon - Breakout', year: 2026 }, [{ title: 'Barbara Gordon: Breakout', year: 2026 }], [named(99, 'Barbara Gordon: Breakout')]).status).toBe('matched');
    expect(matchSeries({ title: 'The Flash', year: 2025 }, [{ title: 'Flash', year: 2025 }], [named(1, 'Flash')]).status).toBe('matched');
  });

  it('does not take another run with the same name for it', () => {
    expect(matchSeries({ title: 'Batman', year: 2016 }, volumes, kavita)).toEqual({ status: 'missing' });
  });

  it('leaves it alone when it can not be certain', () => {
    expect(matchSeries({ title: 'Batman', year: 2025 }, [], kavita).status).toBe('unsure');
    expect(matchSeries({ title: 'Batman', year: 2025 }, [...volumes, { title: 'Batman', year: 2016 }], kavita).status).toBe('unsure');
    expect(matchSeries({ title: 'Batman', year: null }, volumes, kavita).status).toBe('unsure');
    expect(matchSeries({ title: 'Batman', year: 2025 }, [{ title: 'Batman', year: null }], kavita).status).toBe('unsure');
    expect(matchSeries({ title: 'Batman', year: 2025 }, volumes, [...kavita, named(84, 'Batman')]).status).toBe('unsure');
  });

  it('knows when a comic is not in Kavita', () => {
    expect(matchSeries({ title: 'Saga', year: 2012 }, volumes, kavita)).toEqual({ status: 'missing' });
  });
});

describe('chaptersToMark', () => {
  it('only picks read issues that are not finished yet', () => {
    const special = { ...chapter(5, 3), isSpecial: true };
    const range = { ...chapter(6, 3), maxNumber: 5 };
    expect(chaptersToMark([chapter(1, 1, 20), chapter(2, 2, 3), chapter(3, 3), chapter(4, 4), special, range], [1, 2, 3])).toEqual([2, 3]);
  });
});

describe('syncReadingList', () => {
  it('marks what was read, with the key of that user', async () => {
    await syncReadingList(userId);

    expect(servers.state.tokens).toEqual(['alice-key']);
    expect(servers.state.marked).toEqual([{ seriesId: 83, chapterIds: [2, 3], auth: 'Bearer jwt-of-alice-key' }]);
    const status = readingSyncStatus(userId);
    expect(status.lastError).toBeNull();
    expect(status.lastResult).toEqual({ series: 1, matched: 1, marked: 2, unsure: [] });
  });

  it('never touches another run with the same name', async () => {
    locg.series = [{ id: 501, title: 'Batman', year: 2016, publisher: 'DC Comics', count: 3 }];
    await syncReadingList(userId);
    expect(servers.state.marked).toEqual([]);
    expect(locg.issueCalls).toEqual([]);
  });

  it('only asks League of Comic Geeks about comics in Kavita', async () => {
    locg.series = [
      { id: 500, title: 'Batman', year: 2025, publisher: 'DC Comics', count: 3 },
      { id: 600, title: 'Saga', year: 2012, publisher: 'Image', count: 54 },
    ];
    await syncReadingList(userId);
    expect(locg.issueCalls).toEqual([500]);
  });

  it('does not ask again when nothing changed, and does not undo unmarking', async () => {
    await syncReadingList(userId);
    locg.issueCalls = [];
    servers.state.marked = [];
    // Someone marks #2 as unread in Kavita on purpose
    servers.state.chapters[1].pagesRead = 0;

    await syncReadingList(userId);
    expect(locg.issueCalls).toEqual([]);
    expect(servers.state.marked).toEqual([]);
  });

  it('marks more when the read list grew', async () => {
    await syncReadingList(userId);
    locg.series = [{ ...locg.series[0], count: 4 }];
    locg.issues = { 500: [1, 2, 3, 4] };
    servers.state.marked = [];

    await syncReadingList(userId);
    expect(servers.state.marked[0].chapterIds).toEqual([4]);
  });

  it('marks new downloads of something already read', async () => {
    servers.state.chapters = [chapter(1, 1)];
    await syncReadingList(userId);
    servers.state.chapters.push(chapter(2, 2));
    servers.state.marked = [];

    await syncReadingList(userId);
    expect(servers.state.marked[0].chapterIds).toEqual([2]);
  });

  it('keeps the progress and reports it when League of Comic Geeks fails', async () => {
    locg.fail = new Error('League of Comic Geeks returned HTTP 503');
    await syncReadingList(userId);
    expect(readingSyncStatus(userId).lastError).toContain('503');
    expect(servers.state.marked).toEqual([]);
  });

  it('asks to connect again when the key stopped working', async () => {
    servers.state.keyWorks = false;
    await syncReadingList(userId);
    expect(readingSyncStatus(userId)).toMatchObject({ kavitaReady: false, lastError: 'Kavita rejected the API key' });
  });
});

describe('syncDueReadingLists', () => {
  it('skips who was synced today', async () => {
    await syncDueReadingLists();
    expect(servers.state.tokens).toHaveLength(1);
    await syncDueReadingLists();
    expect(servers.state.tokens).toHaveLength(1);
  });
});

describe('the Kavita key', () => {
  it('never reaches the browser', () => {
    const key = 'alice-key';
    expect(JSON.stringify(readingSyncStatus(userId))).not.toContain(key);
    expect(JSON.stringify(toPublicUser(getUser(userId)!))).not.toContain(key);
  });

  it('comes with connecting Kavita, and goes with disconnecting', async () => {
    const other = (await createUser(null, { email: 'b@x.nl', username: 'bob', password: 'password1', permissions: Permission.REQUEST })).id;
    expect(readingSyncStatus(other).kavitaReady).toBe(false);

    await linkKavita(getUser(other)!, 'alice', 'kavita-pass');
    expect(readingSyncStatus(other).kavitaReady).toBe(true);

    unlinkKavita(getUser(other)!);
    expect(readingSyncStatus(other).kavitaReady).toBe(false);
  });

  it('connecting again gives a connected account its key', async () => {
    const user = getUser(userId)!;
    await linkKavita(user, 'alice', 'kavita-pass');
    expect(getUser(userId)!.kavitaLinkId).toBe('7');
    await expect(linkKavita(getUser(userId)!, 'alice', 'kavita-pass')).resolves.toBeDefined();
  });

  it('comes with signing in with Kavita', async () => {
    const user = await authenticate('kavitauser', 'kavita-pass');
    expect(readingSyncStatus(user!.id).kavitaReady).toBe(true);
  });
});
