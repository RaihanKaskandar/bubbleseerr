/**
 * The data behind a poster card (TitleCard). Every list in the UI (search,
 * discover, requests) is turned into these.
 */
import { inArray } from 'drizzle-orm';

import { isCollectedEdition, isEnglishPublisher } from '@app/lib/publishers';
import type { RequestStatus } from '@app/lib/types';
import type { LibraryStatus, LookupVolume } from '@app/server/bubblarr';
import { getDb } from '@app/server/db';
import { requests } from '@app/server/db/schema';

export interface CardData {
  comicvineId: number;
  title: string;
  year: number | null;
  publisher: string | null;
  volumeNumber: number | null;
  issueCount: number | null;
  coverUrl: string | null;
  libraryStatus: LibraryStatus;
  /** The status of the newest request for it, if any */
  requestStatus: RequestStatus | null;
  translated: boolean;
  /** A trade paperback, hardcover or omnibus instead of single issues */
  collected?: boolean;
  /** Extra line, e.g. "Out Oct 22" */
  subtitle?: string;
}

/** The newest request status per ComicVine ID */
export function requestStatuses(
  comicvineIds: number[]
): Map<number, RequestStatus> {
  const result = new Map<number, RequestStatus>();
  if (!comicvineIds.length) {
    return result;
  }
  const rows = getDb()
    .select({
      comicvineId: requests.comicvineId,
      status: requests.status,
      createdAt: requests.createdAt,
    })
    .from(requests)
    .where(inArray(requests.comicvineId, comicvineIds))
    .all()
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const row of rows) {
    result.set(row.comicvineId, row.status as RequestStatus);
  }
  return result;
}

/** Image proxy URL for the cover of a library volume */
export function libraryCoverUrl(volumeId: number): string {
  return `/api/v1/image/volume/${volumeId}`;
}

export function lookupToCards(volumes: LookupVolume[]): CardData[] {
  const statuses = requestStatuses(volumes.map((v) => v.comicvine_id));
  return volumes.map((v) => ({
    comicvineId: v.comicvine_id,
    title: v.title,
    year: v.year,
    publisher: v.publisher,
    volumeNumber: v.volume_number,
    issueCount: v.issue_count,
    coverUrl: v.cover_link || null,
    libraryStatus: v.library.status,
    requestStatus: statuses.get(v.comicvine_id) ?? null,
    // Comics from publishers in other languages count as foreign too
    translated: v.translated || !isEnglishPublisher(v.publisher),
    collected: isCollectedEdition(v.title, v.description),
  }));
}
