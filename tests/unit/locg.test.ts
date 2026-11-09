import { afterEach, describe, expect, it, vi } from 'vitest';

import { findProfile, LocgError, parseIssueNumbers, parseSeries, profileName, readIssueNumbers, readSeries } from '@app/server/locg';

function seriesItem(id: number, title: string, publisher: string, year: number, count: number) {
  return `<li>
    <div class="cover">
      <a href="/profile/someone/read-list/${id}" class="link-collection-series" data-id="${id}"><img alt="${title}"></a>
      <span class="details count-issues"> ${count} </span>
    </div>
    <div class="copy-really-small font-weight-bold color-offset text-truncate">
      <span class="">${publisher}</span>
      <span class=""> &nbsp;&middot;&nbsp; ${year} </span>
    </div>
    <div class="title color-primary">
      <a href="/profile/someone/read-list/${id}" class="link-collection-series" data-id="${id}"> ${title} </a>
    </div>
  </li>`;
}

function issueItem(id: number, title: string) {
  return `<li id="comic-${id}" class="issue " data-comic="${id}" data-parent="0" data-row="1">
    <div class="title color-primary" data-sorting="${title}">
      <a href="/comic/${id}/slug">${title}</a>
    </div>
    <div class="comic-details comic-release"><span class="publisher color-offset">DC Comics</span></div>
  </li>`;
}

function listResponse(count: number, list: string) {
  return new Response(JSON.stringify({ count, list }), { headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('profileName', () => {
  it('takes a link or a name', () => {
    expect(profileName('someone')).toBe('someone');
    expect(profileName(' https://leagueofcomicgeeks.com/profile/some.one/pull-list?x=1 ')).toBe('some.one');
    expect(profileName('leagueofcomicgeeks.com/profile/someone')).toBe('someone');
  });

  it('refuses what could point somewhere else', () => {
    for (const input of ['../../comic/x', 'a/b', 'https://evil.test/profile/someone', 'some one', '']) {
      expect(profileName(input), input).toBeNull();
    }
  });
});

describe('parsing', () => {
  it('reads the series of a read list', () => {
    const html = `<ul>${seriesItem(130418, '24: Legacy &amp; Rules', 'IDW Publishing', 2017, 5)}${seriesItem(118893, 'Aliens', 'Dark Horse Comics', 1998, 1)}</ul>`;
    expect(parseSeries(html)).toEqual([
      { id: 130418, title: '24: Legacy & Rules', year: 2017, publisher: 'IDW Publishing', count: 5 },
      { id: 118893, title: 'Aliens', year: 1998, publisher: 'Dark Horse Comics', count: 1 },
    ]);
  });

  it('reads issue numbers, once each', () => {
    const html = ['Batman #1', 'Batman #12', 'Batman #0.5', 'Batman #1 Cover B', 'Batman #2A', 'Batman Vol. 1 TP']
      .map((title, i) => issueItem(i, title))
      .join('');
    expect(parseIssueNumbers(html)).toEqual([1, 12, 0.5]);
  });
});

describe('reading from the site', () => {
  it('gives an error instead of an empty list for a page that is no list', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 60_000);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Just a moment...</html>')));
    await expect(readSeries(1)).rejects.toThrow(LocgError);
  });

  it('notices when the format of the list changed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 120_000);
    vi.stubGlobal('fetch', vi.fn(async () => listResponse(5, '<div>something new</div>')));
    await expect(readSeries(1)).rejects.toThrow('format');
  });

  it('finds the user ID of a profile', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 180_000);
    const fetchMock = vi.fn(async () => new Response('<div data-user="26853"></div>'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await findProfile('someone')).toEqual({ userId: 26853, username: 'someone' });
    expect(String(fetchMock.mock.calls[0]?.[0 as never])).toBe('https://leagueofcomicgeeks.com/profile/someone/read-list');
  });

  it('never sends two requests within 30 seconds, also not for several callers', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 240_000);
    const times: number[] = [];
    vi.stubGlobal('fetch', vi.fn(async () => {
      times.push(Date.now());
      return listResponse(0, '');
    }));

    const all = Promise.all([readSeries(1), readSeries(2), readIssueNumbers(3, 4)]);
    await vi.advanceTimersByTimeAsync(100_000);
    await all;

    expect(times).toHaveLength(3);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(30_000);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(30_000);
  });
});
