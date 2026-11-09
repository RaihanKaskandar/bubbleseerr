/**
 * Finds comics in Kavita, for the "Read in Kavita" button, and asks Kavita to
 * scan its libraries when Bubblarr downloaded something, so new comics show
 * up there without waiting for Kavita's nightly scan.
 * Kavita API: POST /api/Plugin/authenticate?apiKey=&pluginName= gives a JWT,
 * GET /api/Search/search?queryString= finds series, GET /api/Library/libraries
 * lists the libraries and POST /api/Library/scan?libraryId= scans one (needs
 * the API key of a Kavita admin).
 *
 * Read progress is per Kavita user, so marking comics as read uses the key of
 * that user: POST /api/Series/all-v2 lists their series, GET
 * /api/Series/volumes?seriesId= gives the chapters with their progress and
 * POST /api/Reader/mark-multiple-read marks chapters.
 */
import { eq, isNull } from 'drizzle-orm';

import { normaliseUrl } from '@app/server/bubblarr';
import { getDb } from '@app/server/db';
import { kavitaLinks } from '@app/server/db/schema';
import { getSettings } from '@app/server/settings';

const PLUGIN_NAME = 'Bubbleseerr';
/** How long a found (or not found) link is remembered */
const LINK_TTL = 24 * 60 * 60 * 1000;
const NOT_FOUND_TTL = 60 * 60 * 1000;

interface KavitaSeries {
  seriesId: number;
  name: string;
  originalName: string;
  localizedName: string;
  libraryId: number;
  releaseYear: number;
}

export class KavitaError extends Error {}
/** The key is wrong or was removed in Kavita */
export class KavitaKeyError extends KavitaError {}

let tokenCache: { key: string; token: string; expires: number } | null = null;

/** Sign in with the key of a Kavita user. Throws a KavitaError. */
export async function kavitaToken(url: string, apiKey: string): Promise<string> {
  const endpoint = new URL(`${normaliseUrl(url)}/api/Plugin/authenticate`);
  endpoint.searchParams.set('apiKey', apiKey);
  endpoint.searchParams.set('pluginName', PLUGIN_NAME);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new KavitaError("Couldn't connect to Kavita");
  }
  if (response.status === 401) {
    throw new KavitaKeyError('Kavita rejected the API key');
  }
  if (!response.ok) {
    throw new KavitaError(`Kavita returned HTTP ${response.status}`);
  }
  const user = (await response.json()) as { token?: string; username?: string };
  if (!user.token) {
    throw new KavitaError('Kavita did not return a token');
  }
  return user.token;
}

async function authenticate(url: string, apiKey: string): Promise<string> {
  const cacheKey = `${url}|${apiKey}`;
  if (tokenCache && tokenCache.key === cacheKey && tokenCache.expires > Date.now()) {
    return tokenCache.token;
  }
  const token = await kavitaToken(url, apiKey);
  // Kavita's tokens are valid for days; renew well before that
  tokenCache = { key: cacheKey, token, expires: Date.now() + 60 * 60 * 1000 };
  return token;
}

/** Check the connection. Returns the Kavita username of the API key. */
export async function testKavita(url: string, apiKey: string): Promise<void> {
  tokenCache = null;
  await authenticate(url, apiKey);
}

export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    // Years, also "(2021-)" and "(2016-2020)"
    .replace(/\(\d{4}(-\d{0,4})?\)/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
}

/** Pick the series that matches a comic best, by title and year */
export function pickSeries(
  series: KavitaSeries[],
  title: string,
  year: number | null
): KavitaSeries | undefined {
  const wanted = normaliseTitle(title);
  const matches = series.filter((s) =>
    [s.name, s.originalName, s.localizedName].some(
      (n) => n && normaliseTitle(n) === wanted
    )
  );
  if (matches.length <= 1 || !year) {
    return matches[0];
  }
  return (
    matches.find((s) => s.releaseYear === year) ??
    matches.find((s) => Math.abs(s.releaseYear - year) <= 1) ??
    matches[0]
  );
}

async function searchSeries(
  url: string,
  apiKey: string,
  query: string
): Promise<KavitaSeries[]> {
  const token = await authenticate(url, apiKey);
  const endpoint = new URL(`${normaliseUrl(url)}/api/Search/search`);
  // Kavita searches by words; "Barbara Gordon: Breakout" is "Barbara Gordon - Breakout" there
  query = query.replace(/[^\p{L}\p{N}&'\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
  endpoint.searchParams.set('queryString', query);
  endpoint.searchParams.set('includeChapterAndFiles', 'false');
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 401) {
    tokenCache = null;
    throw new KavitaError('Kavita rejected the login');
  }
  if (!response.ok) {
    throw new KavitaError(`Kavita returned HTTP ${response.status}`);
  }
  const result = (await response.json()) as { series?: KavitaSeries[] };
  return result.series ?? [];
}

/**
 * The URL of a comic in Kavita, or null when it isn't there (or Kavita isn't
 * set up). Never throws.
 */
export async function getKavitaLink(
  comicvineId: number,
  title: string,
  year: number | null,
  /** Look again even when it wasn't found a moment ago */
  fresh = false
): Promise<string | null> {
  const { kavitaUrl, kavitaApiKey } = getSettings();
  if (!kavitaUrl || !kavitaApiKey) {
    return null;
  }

  const db = getDb();
  const cached = db
    .select()
    .from(kavitaLinks)
    .where(eq(kavitaLinks.comicvineId, comicvineId))
    .get();
  if (
    cached &&
    !(fresh && !cached.url) &&
    Date.now() - cached.checkedAt < (cached.url ? LINK_TTL : NOT_FOUND_TTL)
  ) {
    return cached.url;
  }

  let url: string | null = null;
  try {
    const series = pickSeries(
      await searchSeries(kavitaUrl, kavitaApiKey, title),
      title,
      year
    );
    if (series) {
      url = `${normaliseUrl(kavitaUrl)}/library/${series.libraryId}/series/${series.seriesId}`;
    }
  } catch (e) {
    if (fresh) {
      throw e;
    }
    console.warn('Kavita lookup failed:', e instanceof Error ? e.message : e);
    // Remembered too, so a Kavita that is down doesn't hold up every comic page
    url = cached?.url ?? null;
  }

  db.insert(kavitaLinks)
    .values({ comicvineId, url, checkedAt: Date.now() })
    .onConflictDoUpdate({
      target: kavitaLinks.comicvineId,
      set: { url, checkedAt: Date.now() },
    })
    .run();
  return url;
}

export function clearKavitaLinks(): void {
  getDb().delete(kavitaLinks).run();
}

/** Forget the comics that weren't found, so they're looked up again */
export function clearMissingKavitaLinks(): void {
  getDb().delete(kavitaLinks).where(isNull(kavitaLinks.url)).run();
}

/** Library types with comics: Comic and Comic (ComicVine) */
const COMIC_LIBRARY_TYPES = [1, 5];
/** Don't ask Kavita to scan more often than this */
const MIN_SCAN_INTERVAL = 60 * 1000;
let lastScan = 0;
let scheduledScan: ReturnType<typeof setTimeout> | null = null;

/**
 * Ask Kavita to scan its comic libraries now. Kavita scans in the background;
 * a scan of a library that didn't change is quick. Throws a KavitaError.
 */
export async function scanKavita(): Promise<void> {
  const { kavitaUrl, kavitaApiKey } = getSettings();
  if (!kavitaUrl || !kavitaApiKey) {
    throw new KavitaError('Kavita is not set up');
  }
  const token = await authenticate(kavitaUrl, kavitaApiKey);
  const headers = { Authorization: `Bearer ${token}` };
  const base = normaliseUrl(kavitaUrl);

  let response: Response;
  try {
    response = await fetch(`${base}/api/Library/libraries`, { headers, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new KavitaError("Couldn't connect to Kavita");
  }
  if (!response.ok) {
    throw new KavitaError(`Kavita returned HTTP ${response.status}`);
  }
  const libraries = (await response.json()) as { id: number; type: number }[];
  const comicLibraries = libraries.filter((l) => COMIC_LIBRARY_TYPES.includes(l.type));

  lastScan = Date.now();
  for (const library of comicLibraries.length ? comicLibraries : libraries) {
    const scan = await fetch(`${base}/api/Library/scan?libraryId=${library.id}&force=false`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (scan && (scan.status === 401 || scan.status === 403)) {
      throw new KavitaError('Only a Kavita admin can start a scan; use the API key of an admin');
    }
    if (!scan?.ok) {
      throw new KavitaError(`Kavita didn't start the scan${scan ? ` (HTTP ${scan.status})` : ''}`);
    }
  }
  clearMissingKavitaLinks();
}

/**
 * Scan Kavita a little later, e.g. after Bubblarr imported a download. A
 * batch of imports gives one scan.
 */
export function scheduleKavitaScan(delay = 30 * 1000): void {
  const { kavitaUrl, kavitaApiKey } = getSettings();
  if (!kavitaUrl || !kavitaApiKey || scheduledScan) {
    return;
  }
  const wait = Math.max(delay, lastScan + MIN_SCAN_INTERVAL - Date.now());
  scheduledScan = setTimeout(() => {
    scheduledScan = null;
    scanKavita().catch((e) => console.warn('Kavita scan failed:', e instanceof Error ? e.message : e));
  }, wait);
}

/**
 * Find a comic in Kavita, scanning first when it isn't there yet. Waits a
 * while for the scan; returns null when Kavita still doesn't have it.
 */
export async function findInKavita(
  comicvineId: number,
  title: string,
  year: number | null
): Promise<string | null> {
  const existing = await getKavitaLink(comicvineId, title, year, true);
  if (existing) {
    return existing;
  }
  if (Date.now() - lastScan > MIN_SCAN_INTERVAL) {
    await scanKavita();
  }
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const url = await getKavitaLink(comicvineId, title, year, true);
    if (url) {
      return url;
    }
  }
  return null;
}

// region Read progress
export interface KavitaSeriesName {
  id: number;
  name: string;
  originalName: string;
  localizedName: string;
}

export interface KavitaChapter {
  id: number;
  minNumber: number;
  maxNumber: number;
  pages: number;
  pagesRead: number;
  isSpecial: boolean;
}

async function userCall<T>(url: string, token: string, path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${normaliseUrl(url)}/api${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new KavitaError("Couldn't connect to Kavita");
  }
  if (response.status === 401) {
    throw new KavitaKeyError('Kavita rejected the login');
  }
  if (!response.ok) {
    throw new KavitaError(`Kavita returned HTTP ${response.status}`);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** The series this Kavita user can see */
export function kavitaSeries(url: string, token: string): Promise<KavitaSeriesName[]> {
  return userCall(url, token, '/Series/all-v2?pageNumber=1&pageSize=0', {
    method: 'POST',
    body: JSON.stringify({ statements: [], combination: 1, limitTo: 0, sortOptions: { sortField: 1, isAscending: true } }),
  });
}

/** The chapters of a series, with the progress of this Kavita user */
export async function kavitaChapters(url: string, token: string, seriesId: number): Promise<KavitaChapter[]> {
  const volumes = await userCall<{ chapters?: KavitaChapter[] }[]>(url, token, `/Series/volumes?seriesId=${seriesId}`);
  return volumes.flatMap((v) => v.chapters ?? []);
}

export async function markChaptersRead(url: string, token: string, seriesId: number, chapterIds: number[]): Promise<void> {
  await userCall(url, token, '/Reader/mark-multiple-read', {
    method: 'POST',
    body: JSON.stringify({ seriesId, volumeIds: [], chapterIds, generateReadingSession: false }),
  });
}
