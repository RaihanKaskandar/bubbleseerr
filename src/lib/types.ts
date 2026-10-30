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
  email: string;
  username: string;
  displayName: string;
  permissions: number;
  /** The user's own publisher choice; null = the default */
  publishers: string[] | null;
  /** local, kavita or komga: where the account signs in */
  authSource: string;
  externalId: string | null;
  /** The Kavita account a local account is connected to */
  kavitaLinkId: string | null;
  createdAt: number;
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
  requestedByUser: { id: number; displayName: string; email: string };
}

export interface Paginated<T> {
  pageInfo: { page: number; pages: number; pageSize: number; results: number };
  results: T[];
}

export interface ApiErrorBody {
  error: string;
  message: string;
}
