import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getKavitaLink, normaliseTitle, pickSeries, scanKavita } from '@app/server/kavita';
import { updateSettings } from '@app/server/settings';

import { useTestDb } from './helpers';

/** A pretend Kavita that has "Barbara Gordon - Breakout" only after a scan */
function fakeKavita() {
  const state = { scanned: false, scans: [] as string[], queries: [] as string[] };
  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/Plugin/authenticate') {
      return new Response(JSON.stringify({ token: 'jwt', username: 'admin' }));
    }
    if (url.pathname === '/api/Library/libraries') {
      return new Response(JSON.stringify([{ id: 1, type: 1 }, { id: 2, type: 2 }]));
    }
    if (url.pathname === '/api/Library/scan' && init?.method === 'POST') {
      state.scans.push(url.searchParams.get('libraryId')!);
      state.scanned = true;
      return new Response('');
    }
    if (url.pathname === '/api/Search/search') {
      state.queries.push(url.searchParams.get('queryString')!);
      const series = state.scanned
        ? [{ seriesId: 99, name: 'Barbara Gordon - Breakout', originalName: '', localizedName: '', libraryId: 1, releaseYear: 2026 }]
        : [];
      return new Response(JSON.stringify({ series }));
    }
    throw new Error(`unexpected ${url}`);
  });
  return { state, fetchMock };
}

let kavita: ReturnType<typeof fakeKavita>;

beforeEach(() => {
  useTestDb();
  kavita = fakeKavita();
  vi.stubGlobal('fetch', kavita.fetchMock);
  updateSettings({ kavitaUrl: 'http://kavita:5000', kavitaApiKey: 'key' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Kavita', () => {
  it('matches titles the way Kavita names series', () => {
    expect(normaliseTitle('Barbara Gordon: Breakout')).toBe(normaliseTitle('Barbara Gordon - Breakout'));
    expect(normaliseTitle('Robin & Batman (2021-)')).toBe(normaliseTitle('Robin and Batman'));
    const series = [
      { seriesId: 1, name: 'Titans', originalName: '', localizedName: '', libraryId: 1, releaseYear: 2016 },
      { seriesId: 2, name: 'Titans', originalName: '', localizedName: '', libraryId: 1, releaseYear: 2023 },
    ];
    expect(pickSeries(series, 'Titans', 2023)?.seriesId).toBe(2);
    expect(pickSeries(series, 'Teen Titans', 2026)).toBeUndefined();
  });

  it('searches without punctuation and finds the comic after a scan', async () => {
    expect(await getKavitaLink(171903, 'Barbara Gordon: Breakout', 2026)).toBeNull();
    expect(kavita.state.queries).toEqual(['Barbara Gordon Breakout']);

    await scanKavita();
    // Only the comic library is scanned, not the book library
    expect(kavita.state.scans).toEqual(['1']);
    // The scan forgets that it wasn't found, so it's looked up again
    expect(await getKavitaLink(171903, 'Barbara Gordon: Breakout', 2026)).toBe('http://kavita:5000/library/1/series/99');
  });
});
