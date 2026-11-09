/**
 * Marks what someone read according to League of Comic Geeks as read in their
 * own Kavita account. It only ever marks as read, never as unread, so progress
 * in Kavita is never lost.
 *
 * Which comic is which has to be certain, as marking the wrong one can't be
 * seen afterwards. Kavita's years are not reliable (often 0 or the newest
 * issue) and it may just call a series "Batman", so the year is checked in
 * Bubblarr, which has ComicVine's: LoCG (title and year) -> Bubblarr (title
 * and year) -> Kavita (title). Everything else is left alone and reported.
 */
import { eq } from 'drizzle-orm';

import type { ReadingSyncResult, ReadingSyncStatus } from '@app/lib/types';
import { bubblarr, type LibraryVolume } from '@app/server/bubblarr';
import { getDb } from '@app/server/db';
import { readingSync } from '@app/server/db/schema';
import {
  kavitaChapters,
  KavitaKeyError,
  kavitaSeries,
  kavitaToken,
  markChaptersRead,
  normaliseTitle,
  type KavitaChapter,
  type KavitaSeriesName,
} from '@app/server/kavita';
import { readIssueNumbers, readSeries, type LocgProfile, type LocgSeries } from '@app/server/locg';
import { getSettings } from '@app/server/settings';

const SYNC_EVERY = 24 * 60 * 60 * 1000;
/** A year apart happens: a series can start around new year */
const YEAR_MARGIN = 1;

type SeriesState = Record<string, { read: number; chapters: number }>;

// On globalThis, as the background jobs have their own copy of this module
const g = globalThis as unknown as { bubbleseerrReadingSyncs?: Set<number> };
const running = (g.bubbleseerrReadingSyncs ??= new Set<number>());

function getRow(userId: number) {
  return getDb().select().from(readingSync).where(eq(readingSync.userId, userId)).get();
}

function save(userId: number, values: Partial<typeof readingSync.$inferInsert>): void {
  getDb()
    .insert(readingSync)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: readingSync.userId, set: values })
    .run();
}

export function saveKavitaKey(userId: number, key: string | undefined): void {
  if (key) {
    save(userId, { kavitaKey: key });
  }
}

export function forgetKavitaKey(userId: number): void {
  save(userId, { kavitaKey: null });
}

export function connectLocg(userId: number, profile: LocgProfile): void {
  // A new list: nothing from the old one says anything about it
  save(userId, {
    locgUserId: profile.userId,
    locgUsername: profile.username,
    seriesState: null,
    lastResult: null,
    lastError: null,
    lastSync: null,
  });
}

export function disconnectLocg(userId: number): void {
  save(userId, { locgUserId: null, locgUsername: null, seriesState: null, lastResult: null, lastError: null, lastSync: null });
}

/** What the browser may know; never the key */
export function readingSyncStatus(userId: number): ReadingSyncStatus {
  const row = getRow(userId);
  return {
    kavitaReady: !!row?.kavitaKey,
    locgUsername: row?.locgUsername ?? null,
    running: running.has(userId),
    lastSync: row?.lastSync ?? null,
    lastError: row?.lastError ?? null,
    lastResult: row?.lastResult ? (JSON.parse(row.lastResult) as ReadingSyncResult) : null,
  };
}

function titleKey(title: string): string {
  return normaliseTitle(title).replace(/^the/, '');
}

export type SeriesMatch =
  | { status: 'matched'; seriesId: number }
  | { status: 'missing' }
  | { status: 'unsure'; reason: string };

/** Find the Kavita series of a series on the read list; see the top of this file */
export function matchSeries(
  series: Pick<LocgSeries, 'title' | 'year'>,
  volumes: Pick<LibraryVolume, 'title' | 'year'>[],
  kavita: KavitaSeriesName[]
): SeriesMatch {
  const key = titleKey(series.title);
  const inKavita = kavita.filter((s) =>
    [s.name, s.originalName, s.localizedName].some((name) => name && titleKey(name) === key)
  );
  if (!inKavita.length) {
    return { status: 'missing' };
  }
  if (inKavita.length > 1) {
    return { status: 'unsure', reason: 'Kavita has several series with this name' };
  }
  const inLibrary = volumes.filter((v) => titleKey(v.title) === key);
  if (!inLibrary.length) {
    return { status: 'unsure', reason: "It isn't in Bubblarr, so the year can't be checked" };
  }
  if (inLibrary.length > 1) {
    return { status: 'unsure', reason: 'Bubblarr has several comics with this name' };
  }
  const { year } = inLibrary[0];
  if (!series.year || !year) {
    return { status: 'unsure', reason: 'The year is unknown' };
  }
  // The same name but another run, which isn't in the library
  if (Math.abs(series.year - year) > YEAR_MARGIN) {
    return { status: 'missing' };
  }
  return { status: 'matched', seriesId: inKavita[0].id };
}

/** The chapters to mark: read on the list, not yet in Kavita. Specials have their own numbers. */
export function chaptersToMark(chapters: KavitaChapter[], readNumbers: number[]): number[] {
  const read = new Set(readNumbers);
  return chapters
    .filter((c) => !c.isSpecial && c.minNumber === c.maxNumber && read.has(c.minNumber) && c.pagesRead < c.pages)
    .map((c) => c.id);
}

async function sync(userId: number): Promise<ReadingSyncResult> {
  const row = getRow(userId);
  const { kavitaUrl } = getSettings();
  if (!row?.locgUserId) {
    throw new Error('No League of Comic Geeks profile is connected');
  }
  if (!row.kavitaKey || !kavitaUrl) {
    throw new Error('Kavita is not connected');
  }

  const token = await kavitaToken(kavitaUrl, row.kavitaKey);
  const [volumes, inKavita, series] = await Promise.all([
    bubblarr.libraryVolumes(),
    kavitaSeries(kavitaUrl, token),
    readSeries(row.locgUserId),
  ]);

  const state: SeriesState = row.seriesState ? (JSON.parse(row.seriesState) as SeriesState) : {};
  const result: ReadingSyncResult = { series: series.length, matched: 0, marked: 0, unsure: [] };

  for (const s of series) {
    const match = matchSeries(s, volumes, inKavita);
    if (match.status === 'unsure') {
      result.unsure.push({ title: s.title, year: s.year, reason: match.reason });
    }
    if (match.status !== 'matched') {
      continue;
    }
    result.matched++;

    const chapters = await kavitaChapters(kavitaUrl, token, match.seriesId);
    const unread = chapters.some((c) => c.pagesRead < c.pages);
    const known = state[s.id];
    // Don't bother LoCG when nothing can have changed. This also keeps a comic
    // that was marked unread in Kavita on purpose from coming back as read.
    if (!unread || (known && known.read === s.count && known.chapters === chapters.length)) {
      state[s.id] = { read: s.count, chapters: chapters.length };
      continue;
    }

    const chapterIds = chaptersToMark(chapters, await readIssueNumbers(row.locgUserId, s.id));
    if (chapterIds.length) {
      await markChaptersRead(kavitaUrl, token, match.seriesId, chapterIds);
      result.marked += chapterIds.length;
    }
    state[s.id] = { read: s.count, chapters: chapters.length };
    // Keep what is done, in case something fails halfway through a long sync
    save(userId, { seriesState: JSON.stringify(state) });
  }

  save(userId, { seriesState: JSON.stringify(state) });
  return result;
}

/** Sync one user, one at a time per user. Never throws; the result is stored. */
export async function syncReadingList(userId: number): Promise<void> {
  if (running.has(userId)) {
    return;
  }
  running.add(userId);
  try {
    const lastResult = JSON.stringify(await sync(userId));
    save(userId, { lastSync: Date.now(), lastResult, lastError: null });
  } catch (e) {
    console.warn('Syncing a read list failed:', e instanceof Error ? e.message : e);
    save(userId, {
      lastSync: Date.now(),
      lastError: e instanceof Error ? e.message : 'Syncing failed',
      // The key doesn't work anymore; ask to connect Kavita again
      ...(e instanceof KavitaKeyError ? { kavitaKey: null } : {}),
    });
  } finally {
    running.delete(userId);
  }
}

export function isSyncRunning(userId: number): boolean {
  return running.has(userId);
}

/** The daily sync */
export async function syncDueReadingLists(): Promise<void> {
  try {
    const now = Date.now();
    const due = getDb()
      .select()
      .from(readingSync)
      .all()
      .filter((r) => r.locgUserId && r.kavitaKey && now - (r.lastSync ?? 0) >= SYNC_EVERY);
    for (const row of due) {
      await syncReadingList(row.userId);
    }
  } catch (e) {
    console.warn('Syncing read lists failed:', e);
  }
}
