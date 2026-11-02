/**
 * Requesting comics. Requests are sent to Bubblarr straight away (there is no
 * approval step) and their status follows the status in Bubblarr.
 */
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';

import { Permission } from '@app/lib/permissions';
import type { RequestStatus } from '@app/lib/types';
import { userHasPermission } from '@app/server/auth';
import {
  bubblarr,
  BubblarrError,
  type IssueStatus,
  type LibraryStatus,
  type LookupVolumeDetails,
} from '@app/server/bubblarr';
import { TtlCache } from '@app/server/cache';
import { getDb } from '@app/server/db';
import { requests, users, type ComicRequest, type User } from '@app/server/db/schema';
import { ApiError } from '@app/server/http';
import { clearSearchCache } from '@app/server/search';
import { getSettings } from '@app/server/settings';

export type IssuesSpec = 'all' | 'future' | number[];

// Volume details come from ComicVine, which has a strict rate limit
const volumeCache = new TtlCache<LookupVolumeDetails>(10 * 60 * 1000, 200);

export async function getVolumeDetails(
  comicvineId: number,
  fresh = false
): Promise<LookupVolumeDetails> {
  if (fresh) {
    volumeCache.delete(String(comicvineId));
  }
  return volumeCache.getOrSet(String(comicvineId), () =>
    bubblarr.volume(comicvineId)
  );
}

export function forgetVolumeDetails(comicvineId: number): void {
  volumeCache.delete(String(comicvineId));
  clearSearchCache();
}

export function bubblarrErrorToApiError(e: unknown): unknown {
  if (e instanceof BubblarrError) {
    const status =
      e.code === 'VolumeNotMatched' || e.status === 404
        ? 404
        : e.code === 'not_configured'
          ? 503
          : 502;
    return new ApiError(status, e.message, e.code);
  }
  return e;
}

// region Status
/** The status of a request, based on the status of the volume in Bubblarr */
export function requestStatusFromLibrary(
  status: LibraryStatus
): RequestStatus {
  switch (status) {
    case 'available':
      return 'available';
    case 'partially_available':
      return 'partially_available';
    default:
      return 'processing';
  }
}

/** The status of a request for specific issues */
export function requestStatusFromIssues(
  requested: number[],
  issues: { comicvine_id: number; status: IssueStatus }[]
): RequestStatus {
  const byId = new Map(issues.map((i) => [i.comicvine_id, i.status]));
  const statuses = requested.map((id) => byId.get(id));
  const downloaded = statuses.filter((s) => s === 'downloaded').length;
  if (downloaded === requested.length) {
    return 'available';
  }
  return downloaded > 0 ? 'partially_available' : 'processing';
}

export function parseIssuesSpec(value: string): IssuesSpec {
  return JSON.parse(value) as IssuesSpec;
}

export function describeIssues(
  spec: IssuesSpec,
  volume?: Pick<LookupVolumeDetails, 'issues'>
): string {
  if (spec === 'all') {
    return 'Whole series';
  }
  if (spec === 'future') {
    return 'New issues from now on';
  }
  const numbers = spec.map((id) => {
    const issue = volume?.issues?.find((i) => i.comicvine_id === id);
    return issue ? `#${issue.issue_number}` : '?';
  });
  return numbers.length === 1
    ? `Issue ${numbers[0]}`
    : `Issues ${numbers.join(', ')}`;
}

// region Requests
/**
 * Whether what's being requested is already requested by someone (and not
 * failed), or already available. Returns that request when it is.
 */
export function findCoveringRequest(
  comicvineId: number,
  spec: IssuesSpec
): ComicRequest | undefined {
  const existing = getDb()
    .select()
    .from(requests)
    .where(
      and(eq(requests.comicvineId, comicvineId), ne(requests.status, 'failed'))
    )
    .all();

  for (const r of existing) {
    const other = parseIssuesSpec(r.issuesSpec);
    if (other === 'all') {
      return r;
    }
    if (spec === 'future' && other === 'future') {
      return r;
    }
    if (Array.isArray(spec) && Array.isArray(other)) {
      if (spec.every((id) => other.includes(id))) {
        return r;
      }
    }
  }
  return undefined;
}

export async function createRequest(
  user: User,
  comicvineId: number,
  spec: IssuesSpec
): Promise<{ request: ComicRequest; created: boolean }> {
  const covering = findCoveringRequest(comicvineId, spec);
  if (covering) {
    return { request: covering, created: false };
  }

  let volume: LookupVolumeDetails;
  try {
    volume = await getVolumeDetails(comicvineId);
  } catch (e) {
    throw bubblarrErrorToApiError(e);
  }

  if (Array.isArray(spec)) {
    const known = new Set((volume.issues ?? []).map((i) => i.comicvine_id));
    if (!spec.every((id) => known.has(id))) {
      throw new ApiError(
        400,
        'Some of the chosen issues are not part of this comic',
        'invalid_issues'
      );
    }
  }

  const settings = getSettings();
  let result;
  try {
    result = await bubblarr.request({
      comicvine_id: comicvineId,
      issues: spec,
      root_folder_id: settings.bubblarrRootFolderId ?? undefined,
      search: true,
    });
  } catch (e) {
    throw bubblarrErrorToApiError(e);
  }
  // The library status changed, so the details have to be fetched again
  forgetVolumeDetails(comicvineId);

  const now = Date.now();
  const request = getDb()
    .insert(requests)
    .values({
      comicvineId,
      title: volume.title,
      year: volume.year,
      publisher: volume.publisher,
      coverUrl: volume.cover_link || null,
      issuesSpec: JSON.stringify(spec),
      issuesLabel: describeIssues(spec, volume),
      status: Array.isArray(spec)
        ? 'processing'
        : requestStatusFromLibrary(result.status),
      libraryStatus: result.status,
      bubblarrVolumeId: result.volume_id,
      requestedBy: user.id,
      error: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return { request, created: true };
}

export type RequestFilter = 'all' | RequestStatus;

export interface RequestWithUser extends ComicRequest {
  requestedByUser: { id: number; displayName: string; email: string | null };
}

/** Whether a user may see all requests, or only their own */
export function canSeeAllRequests(user: User): boolean {
  return userHasPermission(
    user,
    [Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW],
    'or'
  );
}

export function listRequests(
  user: User,
  options: {
    filter?: RequestFilter;
    take?: number;
    skip?: number;
    comicvineId?: number;
    mine?: boolean;
  } = {}
): { results: RequestWithUser[]; total: number } {
  const conditions = [];
  if (options.mine || !canSeeAllRequests(user)) {
    conditions.push(eq(requests.requestedBy, user.id));
  }
  if (options.filter && options.filter !== 'all') {
    conditions.push(eq(requests.status, options.filter));
  }
  if (options.comicvineId) {
    conditions.push(eq(requests.comicvineId, options.comicvineId));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const db = getDb();
  const rows = db
    .select({
      request: requests,
      user: { id: users.id, displayName: users.displayName, email: users.email },
    })
    .from(requests)
    .innerJoin(users, eq(users.id, requests.requestedBy))
    .where(where)
    .orderBy(desc(requests.createdAt))
    .limit(options.take ?? 20)
    .offset(options.skip ?? 0)
    .all();
  const total =
    db
      .select({ count: sql<number>`count(*)` })
      .from(requests)
      .where(where)
      .get()?.count ?? 0;

  return {
    results: rows.map((r) => ({ ...r.request, requestedByUser: r.user })),
    total,
  };
}

export function getRequest(id: number): ComicRequest | undefined {
  return getDb().select().from(requests).where(eq(requests.id, id)).get();
}

function assertCanManage(user: User, request: ComicRequest): void {
  if (
    request.requestedBy !== user.id &&
    !userHasPermission(user, Permission.MANAGE_REQUESTS)
  ) {
    throw new ApiError(403, "You can't change this request", 'forbidden');
  }
}

export async function retryRequest(
  user: User,
  id: number
): Promise<ComicRequest> {
  const request = getRequest(id);
  if (!request) {
    throw new ApiError(404, 'Request not found', 'not_found');
  }
  assertCanManage(user, request);

  try {
    if (request.bubblarrVolumeId) {
      await bubblarr.searchVolume(request.bubblarrVolumeId);
    } else {
      const result = await bubblarr.request({
        comicvine_id: request.comicvineId,
        issues: parseIssuesSpec(request.issuesSpec),
        root_folder_id: getSettings().bubblarrRootFolderId ?? undefined,
        search: true,
      });
      request.bubblarrVolumeId = result.volume_id;
    }
  } catch (e) {
    throw bubblarrErrorToApiError(e);
  }

  return getDb()
    .update(requests)
    .set({
      status: request.status === 'failed' ? 'processing' : request.status,
      bubblarrVolumeId: request.bubblarrVolumeId,
      error: null,
      updatedAt: Date.now(),
    })
    .where(eq(requests.id, id))
    .returning()
    .get();
}

export function deleteRequest(user: User, id: number): void {
  const request = getRequest(id);
  if (!request) {
    throw new ApiError(404, 'Request not found', 'not_found');
  }
  assertCanManage(user, request);
  getDb().delete(requests).where(eq(requests.id, id)).run();
}

// region Sync
/**
 * Update the status of requests from Bubblarr. Used by the periodic sync and
 * when a webhook arrives.
 *
 * @param comicvineIds Only update the requests of these volumes.
 */
export async function syncRequestStatuses(
  comicvineIds?: number[]
): Promise<number> {
  const db = getDb();
  const open = db
    .select()
    .from(requests)
    .where(
      comicvineIds
        ? inArray(requests.comicvineId, comicvineIds)
        : ne(requests.status, 'available')
    )
    .all();
  if (!open.length) {
    return 0;
  }

  const ids = [...new Set(open.map((r) => r.comicvineId))];
  const statuses = await bubblarr.statuses(ids);
  const issueStatuses = new Map<
    number,
    { comicvine_id: number; status: IssueStatus }[]
  >();

  let changed = 0;
  for (const request of open) {
    const library = statuses[request.comicvineId];
    if (!library) {
      continue;
    }
    forgetVolumeDetails(request.comicvineId);

    let status: RequestStatus;
    const spec = parseIssuesSpec(request.issuesSpec);
    if (Array.isArray(spec) && library.volume_id) {
      if (!issueStatuses.has(library.volume_id)) {
        const details = await bubblarr.volumeStatus(library.volume_id);
        issueStatuses.set(library.volume_id, details.issue_list);
      }
      status = requestStatusFromIssues(
        spec,
        issueStatuses.get(library.volume_id)!
      );
    } else {
      status = requestStatusFromLibrary(library.status);
    }

    // A failed download stays failed until something new happens
    if (request.status === 'failed' && status === 'processing') {
      status = 'failed';
    }

    if (
      status !== request.status ||
      library.status !== request.libraryStatus ||
      library.volume_id !== request.bubblarrVolumeId
    ) {
      db.update(requests)
        .set({
          status,
          libraryStatus: library.status,
          bubblarrVolumeId: library.volume_id,
          error: status === 'failed' ? request.error : null,
          updatedAt: Date.now(),
        })
        .where(eq(requests.id, request.id))
        .run();
      changed++;
    }
  }
  return changed;
}

/** Mark the open requests of a volume as failed, e.g. after a failed download */
export function markRequestsFailed(comicvineId: number, error: string): void {
  getDb()
    .update(requests)
    .set({ status: 'failed', error, updatedAt: Date.now() })
    .where(
      and(
        eq(requests.comicvineId, comicvineId),
        eq(requests.status, 'processing')
      )
    )
    .run();
}
