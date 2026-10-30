/** The rows of the Discover page */
import type { LibraryStatus } from '@app/lib/types';
import { bubblarr, type LibraryVolume, type ReleaseVolume } from '@app/server/bubblarr';
import { TtlCache } from '@app/server/cache';
import { libraryCoverUrl, requestStatuses, type CardData } from '@app/server/cards';
import { StoredCache } from '@app/server/stored-cache';
import { STARTERS } from '@app/server/starters';
import {
  isEnglishPublisher,
  PUBLISHERS,
  wantsPublisher,
  type Publisher,
} from '@app/lib/publishers';

const libraryCache = new TtlCache<LibraryVolume[]>(5 * 60 * 1000, 1);

function getLibrary(): Promise<LibraryVolume[]> {
  return libraryCache.getOrSet('library', () =>
    bubblarr.libraryVolumes('recently_added')
  );
}

export function libraryStatusOf(v: LibraryVolume): LibraryStatus {
  if (v.issues_downloaded_monitored > 0 && v.issues_downloaded_monitored >= v.issue_count_monitored) {
    return 'available';
  }
  if (v.issues_downloaded > 0) {
    return 'partially_available';
  }
  return v.monitored ? 'wanted' : 'unmonitored';
}

function libraryToCard(v: LibraryVolume, subtitle?: string): CardData {
  return {
    comicvineId: v.comicvine_id,
    title: v.title,
    year: v.year,
    publisher: v.publisher,
    volumeNumber: v.volume_number,
    issueCount: v.issue_count,
    coverUrl: libraryCoverUrl(v.id),
    libraryStatus: libraryStatusOf(v),
    requestStatus: null,
    translated: false,
    subtitle,
  };
}

function withRequestStatuses(cards: CardData[]): CardData[] {
  const statuses = requestStatuses(cards.map((c) => c.comicvineId));
  return cards.map((c) => ({ ...c, requestStatus: statuses.get(c.comicvineId) ?? null }));
}

/** Every comic in the library, newest first, for the Library page */
export async function libraryCards(): Promise<(CardData & { downloaded: number; addedOrder: number })[]> {
  const library = await getLibrary();
  return withRequestStatuses(
    library.map((v) => libraryToCard(v, `${v.issues_downloaded} / ${v.issue_count} issues`))
  ).map((card, i) => ({ ...card, downloaded: library[i].issues_downloaded, addedOrder: i }));
}

export async function recentlyAdded(take = 20): Promise<CardData[]> {
  return withRequestStatuses((await getLibrary()).slice(0, take).map((v) => libraryToCard(v)));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

/** Upcoming issues of comics in the library, one card per comic */
export async function upcoming(days = 60, take = 20): Promise<CardData[]> {
  const today = new Date();
  const end = new Date(today.getTime() + days * 86400000);
  const [issues, library] = await Promise.all([
    bubblarr.calendar(isoDate(today), isoDate(end)),
    getLibrary(),
  ]);
  const byId = new Map(library.map((v) => [v.id, v]));
  const seen = new Set<number>();
  const cards: CardData[] = [];
  for (const issue of issues) {
    const volume = byId.get(issue.volume_id);
    if (!volume || seen.has(volume.id)) {
      continue;
    }
    seen.add(volume.id);
    cards.push(
      libraryToCard(
        volume,
        `#${issue.issue_number} · ${dateFormat.format(new Date(issue.date))}`
      )
    );
    if (cards.length >= take) {
      break;
    }
  }
  return withRequestStatuses(cards);
}

// region Releases
export { isEnglishPublisher, PUBLISHERS, type Publisher };

function isWesternRelease(v: ReleaseVolume): boolean {
  return isEnglishPublisher(v.publisher);
}

function publisherRank(publisher: string | null): number {
  const index = PUBLISHERS.findIndex((p) => publisher && p.matches.includes(publisher));
  return index === -1 ? PUBLISHERS.length : index;
}

const RELEASES_DAYS_BACK = 24;
const RELEASES_DAYS_AHEAD = 6;
/** A bit more than the 6 hours Bubblarr caches them, or we'd get its old copy */
const RELEASES_FRESH_FOR = 6 * 60 * 60 * 1000 + 10 * 60 * 1000;

/**
 * Everything released in the last few weeks (and announced for the next
 * days) according to ComicVine. One big fetch that all release rows share;
 * ComicVine has a strict rate limit, and it takes Bubblarr a while (14s on a
 * real server), so it runs in the background and rows use the stored copy.
 */
const releases = new StoredCache<ReleaseVolume[]>('releases', RELEASES_FRESH_FOR, async () => {
  const now = Date.now();
  return (
    await bubblarr.releases(
      isoDate(new Date(now - RELEASES_DAYS_BACK * 86400000)),
      isoDate(new Date(now + RELEASES_DAYS_AHEAD * 86400000)),
      2000
    )
  ).filter(isWesternRelease);
});

function recentReleases(): Promise<ReleaseVolume[]> {
  return releases.get();
}

/** For the background job, so people don't have to wait for it */
export function refreshReleases(): Promise<void> {
  return releases.refreshIfStale();
}

function releaseToCard(v: ReleaseVolume, subtitle: string): CardData {
  return {
    comicvineId: v.comicvine_id,
    title: v.title,
    year: v.year,
    publisher: v.publisher,
    volumeNumber: v.volume_number,
    issueCount: v.issue_count,
    coverUrl: v.cover_link,
    libraryStatus: v.library.status,
    requestStatus: null,
    translated: false,
    subtitle,
  };
}

/** How long a row waits for library statuses; it has older ones to show */
const STATUS_TIMEOUT = 3000;

/** The cached release data has old library statuses; get the current ones */
async function withFreshStatuses(cards: CardData[]): Promise<CardData[]> {
  try {
    const statuses = await bubblarr.statuses(cards.map((c) => c.comicvineId), STATUS_TIMEOUT);
    cards = cards.map((c) => ({ ...c, libraryStatus: statuses[c.comicvineId]?.status ?? c.libraryStatus }));
  } catch {
    // Keep the cached ones
  }
  return withRequestStatuses(cards);
}

function byPublisher(a: ReleaseVolume, b: ReleaseVolume): number {
  return publisherRank(a.publisher) - publisherRank(b.publisher);
}

const weekdayFormat = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * New Comic Book Day: the comics of the most recent release day (usually a
 * Wednesday) that ComicVine knows about.
 */
export async function newComicBookDay(publishers: string[]): Promise<{ title: string; results: CardData[] }> {
  const all = await recentReleases();
  const today = isoDate(new Date());
  const dates = [...new Set(all.flatMap((v) => v.issues.map((i) => i.date)).filter((d): d is string => !!d && d <= today))];
  // The release day: the most recent date with a real amount of releases
  const counts = new Map<string, number>();
  for (const v of all) {
    for (const i of v.issues) {
      if (i.date) counts.set(i.date, (counts.get(i.date) ?? 0) + 1);
    }
  }
  const day = dates.sort().reverse().find((d) => (counts.get(d) ?? 0) >= 10) ?? dates[0];
  if (!day) {
    return { title: 'New Comic Book Day', results: [] };
  }

  const cards = all
    .filter((v) => wantsPublisher(publishers, v.publisher) && v.issues.some((i) => i.date === day))
    .sort(byPublisher)
    .slice(0, 60)
    .map((v) => {
      const issues = v.issues.filter((i) => i.date === day);
      return releaseToCard(
        v,
        issues.length <= 3 ? issues.map((i) => `#${i.issue_number}`).join(', ') : `${issues.length} issues`
      );
    });
  return {
    title: `New Comic Book Day · ${weekdayFormat.format(new Date(`${day}T12:00:00`))}`,
    results: await withFreshStatuses(cards),
  };
}

function isFirstIssue(issueNumber: string): boolean {
  return /^0*1(\.0+)?$/.test(issueNumber.trim());
}

/** Brand new series: their #1 came out in the last weeks */
export async function newFirstIssues(publishers: string[]): Promise<CardData[]> {
  const volumes = await recentReleases();
  const cards = volumes
    .filter((v) => wantsPublisher(publishers, v.publisher))
    .map((v) => ({ v, first: v.issues.find((i) => isFirstIssue(i.issue_number)) }))
    .filter((x): x is { v: ReleaseVolume; first: ReleaseVolume['issues'][number] } => !!x.first)
    // Skip one-shots: a new series has more than one issue planned or out
    .filter(({ v }) => v.issue_count !== 1 || v.issues.length > 1)
    .sort((a, b) => (b.first.date ?? '').localeCompare(a.first.date ?? '') || byPublisher(a.v, b.v))
    .slice(0, 40)
    .map(({ v, first }) => releaseToCard(v, `#1 · ${first.date ? dateFormat.format(new Date(`${first.date}T12:00:00`)) : 'New'}`));
  return withFreshStatuses(cards);
}

export interface PublisherTile {
  slug: string;
  name: string;
  logo: string | null;
  seriesCount: number;
  covers: string[];
}

/**
 * The publisher tiles, with covers of their current comics. Only the chosen
 * publishers, unless none of the chosen ones has a tile.
 */
export async function publisherTiles(publishers: string[]): Promise<PublisherTile[]> {
  let volumes: ReleaseVolume[] = [];
  try {
    volumes = await recentReleases();
  } catch {
    // Show the tiles without covers
  }
  const chosen = PUBLISHERS.filter((p) => publishers.includes(p.slug));
  return (chosen.length ? chosen : PUBLISHERS).map((p) => {
    const own = volumes.filter((v) => v.publisher && p.matches.includes(v.publisher));
    return {
      slug: p.slug,
      name: p.name,
      logo: p.logo,
      seriesCount: own.length,
      covers: own.map((v) => v.cover_link).filter((c): c is string => !!c).slice(0, 3),
    };
  });
}

/** The series of a publisher that had issues out in the last weeks */
export async function publisherComics(slug: string): Promise<{ publisher: Publisher; results: CardData[] } | null> {
  const publisher = PUBLISHERS.find((p) => p.slug === slug);
  if (!publisher) {
    return null;
  }
  const volumes = (await recentReleases())
    .filter((v) => v.publisher && publisher.matches.includes(v.publisher))
    .map((v) => ({ v, latest: v.issues.reduce((a, i) => (i.date && i.date > a ? i.date : a), '') }))
    .sort((a, b) => b.latest.localeCompare(a.latest) || a.v.title.localeCompare(b.v.title));
  const cards = volumes.map(({ v }) => {
    const last = v.issues[v.issues.length - 1];
    return releaseToCard(v, last ? `Latest: #${last.issue_number}` : '');
  });
  return { publisher, results: await withFreshStatuses(cards) };
}

// region Starters
/** Hand-picked series that are easy to start with */
export async function startingPoints(publishers: string[]): Promise<CardData[]> {
  const starters = STARTERS.filter((s) => wantsPublisher(publishers, s.publisher));
  let statuses: Record<number, { status: LibraryStatus }> = {};
  try {
    statuses = await bubblarr.statuses(starters.map((s) => s.comicvineId), STATUS_TIMEOUT);
  } catch {
    // Show them without status
  }
  return withRequestStatuses(
    starters.map((s) => ({
      comicvineId: s.comicvineId,
      title: s.title,
      year: s.year,
      publisher: s.publisher,
      volumeNumber: s.volumeNumber,
      issueCount: s.issueCount,
      coverUrl: s.coverUrl,
      libraryStatus: statuses[s.comicvineId]?.status ?? 'not_added',
      requestStatus: null,
      translated: false,
      subtitle: s.pitch,
    }))
  );
}

export function clearDiscoverCache(): void {
  libraryCache.clear();
}


// region Calendar
export interface CalendarEntry {
  date: string;
  comicvineId: number;
  title: string;
  issueNumber: string;
  issueTitle: string | null;
  publisher: string | null;
  coverUrl: string | null;
  /** downloaded | missing | upcoming | unmonitored | not_added */
  status: string;
}

/**
 * The releases between two dates: the issues of library comics, and with
 * `everything`, also the other comics ComicVine lists (only for the last few
 * weeks, the period that is cached).
 */
export async function calendarEntries(
  start: string,
  end: string,
  everything: boolean,
  /** The publishers of the other comics to show */
  publishers: string[]
): Promise<CalendarEntry[]> {
  const today = isoDate(new Date());
  const [issues, library] = await Promise.all([bubblarr.calendar(start, end, false), getLibrary()]);
  const byId = new Map(library.map((v) => [v.id, v]));

  const entries: CalendarEntry[] = [];
  const inLibrary = new Set<number>();
  for (const issue of issues) {
    const volume = byId.get(issue.volume_id);
    if (!volume) continue;
    inLibrary.add(volume.comicvine_id);
    entries.push({
      date: issue.date,
      comicvineId: volume.comicvine_id,
      title: volume.title,
      issueNumber: issue.issue_number,
      issueTitle: issue.title,
      publisher: volume.publisher,
      coverUrl: libraryCoverUrl(volume.id),
      status: issue.downloaded
        ? 'downloaded'
        : issue.date > today
          ? 'upcoming'
          : issue.monitored
            ? 'missing'
            : 'unmonitored',
    });
  }

  if (everything) {
    let releases: ReleaseVolume[] = [];
    try {
      releases = await recentReleases();
    } catch {
      // Only the library then
    }
    for (const v of releases) {
      if (inLibrary.has(v.comicvine_id) || !wantsPublisher(publishers, v.publisher)) continue;
      for (const i of v.issues) {
        if (!i.date || i.date < start || i.date > end) continue;
        entries.push({
          date: i.date,
          comicvineId: v.comicvine_id,
          title: v.title,
          issueNumber: i.issue_number,
          issueTitle: null,
          publisher: v.publisher,
          coverUrl: v.cover_link,
          status: 'not_added',
        });
      }
    }
  }

  const seen = new Set<string>();
  return entries.filter((e) => {
    const key = `${e.comicvineId}|${e.issueNumber}|${e.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(b.status !== 'not_added') - Number(a.status !== 'not_added') ||
      publisherRank(a.publisher) - publisherRank(b.publisher) ||
      a.title.localeCompare(b.title)
  );
}
