import { createHmac } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Permission } from '@app/lib/permissions';
import { bubblarr } from '@app/server/bubblarr';
import { requests } from '@app/server/db/schema';
import { pickSeries } from '@app/server/kavita';
import {
  createRequest,
  describeIssues,
  findCoveringRequest,
  listRequests,
  requestStatusFromIssues,
  requestStatusFromLibrary,
  syncRequestStatuses,
} from '@app/server/requests';
import { updateSettings } from '@app/server/settings';
import { createUser, getUser } from '@app/server/users';
import { verifySignature } from '@app/server/webhook';

import { useTestDb } from './helpers';

const VOLUME = {
  comicvine_id: 101,
  title: 'Absolute Batman',
  year: 2024,
  volume_number: 1,
  cover_link: 'https://comicvine.gamespot.com/a.jpg',
  description: '',
  site_url: '',
  aliases: [],
  publisher: 'DC Comics',
  issue_count: 3,
  translated: false,
  library: { comicvine_id: 101, volume_id: null, status: 'not_added' as const },
  issues: [1, 2, 3].map((n) => ({
    comicvine_id: 1000 + n,
    issue_number: String(n),
    calculated_issue_number: n,
    title: null,
    date: '2025-01-01',
    description: '',
    library: null,
  })),
};

let db: ReturnType<typeof useTestDb>['db'];

beforeEach(() => {
  db = useTestDb().db;
  vi.restoreAllMocks();
  updateSettings({ bubblarrUrl: 'http://bubblarr', bubblarrApiKey: 'key', bubblarrRootFolderId: 2 });
});

async function users() {
  const admin = getUser((await createUser(null, { email: 'a@x.nl', username: 'admin', password: 'password1', permissions: Permission.ADMIN })).id)!;
  const reader = getUser((await createUser(null, { email: 'r@x.nl', username: 'reader', password: 'password1', permissions: Permission.REQUEST })).id)!;
  const other = getUser((await createUser(null, { email: 'o@x.nl', username: 'other', password: 'password1', permissions: Permission.REQUEST })).id)!;
  return { admin, reader, other };
}

describe('status mapping', () => {
  it('maps the library status', () => {
    expect(requestStatusFromLibrary('available')).toBe('available');
    expect(requestStatusFromLibrary('partially_available')).toBe('partially_available');
    expect(requestStatusFromLibrary('wanted')).toBe('processing');
    expect(requestStatusFromLibrary('downloading')).toBe('processing');
  });
  it('looks only at the requested issues', () => {
    const issues = [
      { comicvine_id: 1, status: 'downloaded' as const },
      { comicvine_id: 2, status: 'missing' as const },
    ];
    expect(requestStatusFromIssues([1], issues)).toBe('available');
    expect(requestStatusFromIssues([1, 2], issues)).toBe('partially_available');
    expect(requestStatusFromIssues([2], issues)).toBe('processing');
  });
  it('describes requested issues', () => {
    expect(describeIssues('all')).toBe('Whole series');
    expect(describeIssues('future')).toBe('New issues from now on');
    expect(describeIssues([1001, 1003], VOLUME)).toBe('Issues #1, #3');
    expect(describeIssues([1002], VOLUME)).toBe('Issue #2');
  });
});

describe('requesting', () => {
  it('sends the request to Bubblarr and stores it', async () => {
    const { reader } = await users();
    vi.spyOn(bubblarr, 'volume').mockResolvedValue(VOLUME);
    const send = vi.spyOn(bubblarr, 'request').mockResolvedValue({
      comicvine_id: 101, volume_id: 7, status: 'wanted', added: true, searching: true,
    });

    const { request, created } = await createRequest(reader, 101, 'all');
    expect(created).toBe(true);
    expect(send).toHaveBeenCalledWith({ comicvine_id: 101, issues: 'all', root_folder_id: 2, search: true });
    expect(request).toMatchObject({ title: 'Absolute Batman', status: 'processing', bubblarrVolumeId: 7, issuesLabel: 'Whole series' });
  });

  it("doesn't request what is already requested", async () => {
    const { reader, other } = await users();
    vi.spyOn(bubblarr, 'volume').mockResolvedValue(VOLUME);
    const send = vi.spyOn(bubblarr, 'request').mockResolvedValue({
      comicvine_id: 101, volume_id: 7, status: 'wanted', added: true, searching: true,
    });
    await createRequest(reader, 101, [1001, 1002]);
    expect(findCoveringRequest(101, [1001])).toBeDefined();
    expect(findCoveringRequest(101, [1003])).toBeUndefined();
    expect(findCoveringRequest(101, 'all')).toBeUndefined();

    const again = await createRequest(other, 101, [1002]);
    expect(again.created).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('rejects issues of another comic', async () => {
    const { reader } = await users();
    vi.spyOn(bubblarr, 'volume').mockResolvedValue(VOLUME);
    await expect(createRequest(reader, 101, [9999])).rejects.toThrow(/not part/);
  });

  it('shows users only their own requests unless they may see all', async () => {
    const { admin, reader, other } = await users();
    const now = Date.now();
    for (const user of [reader, other]) {
      db.insert(requests).values({
        comicvineId: 101, title: 'A', issuesSpec: '"all"', issuesLabel: 'Whole series',
        status: 'processing', requestedBy: user.id, createdAt: now, updatedAt: now,
      }).run();
    }
    expect(listRequests(reader).total).toBe(1);
    expect(listRequests(admin).total).toBe(2);
    expect(listRequests(admin, { mine: true }).total).toBe(0);
  });
});

describe('syncing', () => {
  it('updates statuses from Bubblarr', async () => {
    const { reader } = await users();
    const now = Date.now();
    db.insert(requests).values([
      { comicvineId: 101, title: 'A', issuesSpec: '"all"', issuesLabel: 'Whole series', status: 'processing', requestedBy: reader.id, createdAt: now, updatedAt: now },
      { comicvineId: 202, title: 'B', issuesSpec: '[5]', issuesLabel: 'Issue #1', status: 'processing', requestedBy: reader.id, createdAt: now, updatedAt: now },
    ]).run();
    vi.spyOn(bubblarr, 'statuses').mockResolvedValue({
      101: { comicvine_id: 101, volume_id: 1, status: 'available' },
      202: { comicvine_id: 202, volume_id: 2, status: 'partially_available' },
    });
    vi.spyOn(bubblarr, 'volumeStatus').mockResolvedValue({
      comicvine_id: 202, volume_id: 2, status: 'partially_available',
      issue_list: [{ id: 1, comicvine_id: 5, issue_number: '1', monitored: true, status: 'downloaded' }],
    });

    expect(await syncRequestStatuses()).toBe(2);
    const rows = db.select().from(requests).all();
    expect(rows.map((r) => r.status)).toEqual(['available', 'available']);
  });
});

describe('webhooks', () => {
  it('checks the signature', () => {
    const body = '{"event":"test"}';
    const signature = 'sha256=' + createHmac('sha256', 'secret').update(body).digest('hex');
    expect(verifySignature(body, signature, 'secret')).toBe(true);
    expect(verifySignature(body, signature, 'other')).toBe(false);
    expect(verifySignature(body + ' ', signature, 'secret')).toBe(false);
    expect(verifySignature(body, null, 'secret')).toBe(false);
    expect(verifySignature(body, signature, '')).toBe(false);
  });
});

describe('Bubblarr client', () => {
  it('turns Bubblarr errors into friendly messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'ApiKeyInvalid', result: {} }), { status: 401 })));
    await expect(bubblarr.search('batman')).rejects.toMatchObject({ code: 'ApiKeyInvalid', message: 'Bubblarr rejected the API key' });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(bubblarr.search('batman')).rejects.toMatchObject({ code: 'connection_error' });

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: null, result: [] })));
    vi.stubGlobal('fetch', fetchMock);
    await bubblarr.search('batman & robin');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://bubblarr/api/lookup?query=batman+%26+robin');
    expect(init.headers['X-Api-Key']).toBe('key');
    vi.unstubAllGlobals();
  });
});

describe('Kavita matching', () => {
  const series = (name: string, releaseYear: number, seriesId: number) => ({
    seriesId, name, originalName: name, localizedName: '', libraryId: 1, releaseYear,
  });
  it('matches by title and prefers the right year', () => {
    const results = [series('Batman', 2016, 1), series('Batman', 2025, 2), series('Batman and Robin', 2023, 3)];
    expect(pickSeries(results, 'Batman', 2025)?.seriesId).toBe(2);
    expect(pickSeries(results, 'Batman & Robin', 2023)?.seriesId).toBe(3);
    expect(pickSeries(results, 'Superman', 2025)).toBeUndefined();
  });
});
