/**
 * Types shared by the server and the browser. Only `import type` from server
 * files here, so no server code ends up in the browser.
 */
export type {
  CalendarIssue,
  IssueCounts,
  IssueStatus,
  LibraryStatus,
  LibraryVolume,
  LookupIssue,
  LookupVolume,
  LookupVolumeDetails,
  ReleaseVolume,
  RootFolder,
  VolumeLibraryStatus,
} from '@app/server/bubblarr';

export type RequestStatus =
  | 'processing'
  | 'partially_available'
  | 'available'
  | 'failed';

export interface PublicUser {
  id: number;
  email: string | null;
  username: string;
  displayName: string;
  permissions: number;
  /** The user's own publisher choice; null = the default */
  publishers: string[] | null;
  /** False: a local account signs in with just its name */
  hasPassword: boolean;
  /** local, kavita or komga: where the account signs in */
  authSource: string;
  externalId: string | null;
  /** The Kavita account a local account is connected to */
  kavitaLinkId: string | null;
  createdAt: number;
}

export interface ReadingSyncResult {
  /** Series on the read list */
  series: number;
  /** Of those, the ones that are in Kavita */
  matched: number;
  /** Issues marked as read in Kavita this time */
  marked: number;
  /** In Kavita, but it's not certain it's the same comic, so left alone */
  unsure: { title: string; year: number | null; reason: string }[];
}

export interface ReadingSyncStatus {
  /** Whether a read list can be marked in Kavita: it's connected and has a key */
  kavitaReady: boolean;
  locgUsername: string | null;
  running: boolean;
  lastSync: number | null;
  lastError: string | null;
  lastResult: ReadingSyncResult | null;
}

export interface RequestItem {
  id: number;
  comicvineId: number;
  title: string;
  year: number | null;
  publisher: string | null;
  coverUrl: string | null;
  issuesSpec: string;
  issuesLabel: string;
  status: RequestStatus;
  libraryStatus: string | null;
  bubblarrVolumeId: number | null;
  requestedBy: number;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  requestedByUser: { id: number; displayName: string; email: string | null };
}

export interface Paginated<T> {
  pageInfo: { page: number; pages: number; pageSize: number; results: number };
  results: T[];
}

export interface ApiErrorBody {
  error: string;
  message: string;
}
