/**
 * Client for the API of Bubblarr. All calls happen on the server, so the API
 * key never reaches the browser. See Bubblarr's docs/src/other_docs/api.md.
 */
import { getSettings } from '@app/server/settings';

export type LibraryStatus =
  | 'not_added'
  | 'available'
  | 'partially_available'
  | 'downloading'
  | 'wanted'
  | 'upcoming'
  | 'unmonitored';

export type IssueStatus =
  | 'downloaded'
  | 'downloading'
  | 'missing'
  | 'unmonitored'
  | 'upcoming';

export interface IssueCounts {
  total: number;
  downloaded: number;
  downloading: number;
  missing: number;
  upcoming: number;
  unmonitored: number;
}

export interface VolumeLibraryStatus {
  comicvine_id: number;
  volume_id: number | null;
  status: LibraryStatus;
  title?: string;
  year?: number | null;
  volume_number?: number;
  publisher?: string | null;
  monitored?: boolean;
  monitor_new_issues?: boolean;
  issues?: IssueCounts;
}

export interface LookupVolume {
  comicvine_id: number;
  title: string;
  year: number | null;
  volume_number: number;
  cover_link: string;
  description: string;
  site_url: string;
  aliases: string[];
  publisher: string | null;
  issue_count: number;
  translated: boolean;
  library: VolumeLibraryStatus;
}

export interface LookupIssue {
  comicvine_id: number;
  issue_number: string;
  calculated_issue_number: number;
  title: string | null;
  date: string | null;
  description: string;
  library: {
    issue_id: number;
    monitored: boolean;
    status: IssueStatus;
  } | null;
}

export interface LookupVolumeDetails extends LookupVolume {
  issues: LookupIssue[] | null;
}

export interface LibraryVolume {
  id: number;
  comicvine_id: number;
  title: string;
  year: number | null;
  publisher: string | null;
  volume_number: number;
  description: string;
  monitored: boolean;
  issue_count: number;
  issue_count_monitored: number;
  issues_downloaded: number;
  issues_downloaded_monitored: number;
}

export interface RootFolder {
  id: number;
  folder: string;
}

export interface CalendarIssue {
  issue_id: number;
  volume_id: number;
  volume_title: string;
  volume_year: number | null;
  volume_number: number;
  issue_number: string;
  calculated_issue_number: number;
  title: string | null;
  date: string;
  monitored: boolean;
  downloaded: boolean;
}

export interface ReleaseVolume {
  comicvine_id: number;
  title: string;
  year: number | null;
  volume_number: number;
  publisher: string | null;
  cover_link: string | null;
  issue_count: number;
  issues: { comicvine_id: number; issue_number: string; date: string | null }[];
  library: VolumeLibraryStatus;
}

export type RequestedIssues = 'all' | 'missing' | 'future' | number[];

export interface RequestResult extends VolumeLibraryStatus {
  added: boolean;
  searching: boolean;
}

export class BubblarrError extends Error {
  constructor(
    message: string,
    /** Bubblarr's error name, e.g. "VolumeNotMatched", or a network error */
    public code: string,
    public status: number = 0
  ) {
    super(message);
  }
}

const FRIENDLY_ERRORS: Record<string, string> = {
  ApiKeyInvalid: 'Bubblarr rejected the API key',
  VolumeNotMatched: 'ComicVine does not know this comic',
  MetadataSourceRateLimitReached:
    'ComicVine is busy right now (rate limit reached). Try again in a few minutes.',
  RootFolderNotFound: 'Bubblarr has no root folder to put comics in',
  InvalidComicVineApiKey: 'Bubblarr has no valid ComicVine API key',
};

export interface BubblarrConnection {
  url: string;
  apiKey: string;
}

function connectionFromSettings(): BubblarrConnection {
  const s = getSettings();
  if (!s.bubblarrUrl || !s.bubblarrApiKey) {
    throw new BubblarrError('Bubblarr is not set up yet', 'not_configured');
  }
  return { url: s.bubblarrUrl, apiKey: s.bubblarrApiKey };
}

export function normaliseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

async function call<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    connection?: BubblarrConnection;
    timeout?: number;
  } = {}
): Promise<T> {
  const connection = options.connection ?? connectionFromSettings();
  const url = new URL(`${normaliseUrl(connection.url)}/api${path}`);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined) {
      url.searchParams.set(k, String(v));
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        'X-Api-Key': connection.apiKey,
        ...(options.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(options.timeout ?? 30_000),
      cache: 'no-store',
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'TimeoutError';
    throw new BubblarrError(
      timedOut
        ? 'Bubblarr took too long to answer'
        : "Couldn't connect to Bubblarr",
      timedOut ? 'timeout' : 'connection_error'
    );
  }

  let data: { error: string | null; result: T } | null = null;
  try {
    data = await response.json();
  } catch {
    // Not JSON, e.g. a proxy error page
  }

  if (!response.ok || !data || data.error) {
    const code = data?.error || `http_${response.status}`;
    throw new BubblarrError(
      FRIENDLY_ERRORS[code] ??
        (data?.error
          ? `Bubblarr returned an error: ${data.error}`
          : `Bubblarr returned HTTP ${response.status}`),
      code,
      response.status
    );
  }
  return data.result;
}

export const bubblarr = {
  /** Check a connection: returns the root folders (needs a valid API key) */
  async test(connection: BubblarrConnection): Promise<RootFolder[]> {
    return bubblarr.rootFolders(connection);
  },

  async rootFolders(connection?: BubblarrConnection): Promise<RootFolder[]> {
    const folders = await call<{ id: number; folder: string }[]>(
      '/rootfolder',
      { connection, timeout: 10_000 }
    );
    return folders.map((f) => ({ id: f.id, folder: f.folder }));
  },

  search(query: string): Promise<LookupVolume[]> {
    return call('/lookup', { query: { query } });
  },

  volume(comicvineId: number): Promise<LookupVolumeDetails> {
    return call(`/lookup/${comicvineId}`);
  },

  async statuses(
    comicvineIds: number[],
    timeout?: number
  ): Promise<Record<number, VolumeLibraryStatus>> {
    const result: Record<number, VolumeLibraryStatus> = {};
    // Bubblarr accepts up to 500 IDs per call
    for (let i = 0; i < comicvineIds.length; i += 500) {
      const chunk = comicvineIds.slice(i, i + 500);
      const statuses = await call<Record<string, VolumeLibraryStatus>>(
        '/lookup/status',
        { query: { comicvine_ids: chunk.join(',') }, timeout }
      );
      for (const [id, status] of Object.entries(statuses)) {
        result[Number(id)] = status;
      }
    }
    return result;
  },

  request(body: {
    comicvine_id: number;
    issues: RequestedIssues;
    root_folder_id?: number;
    monitor_new_issues?: boolean;
    search?: boolean;
  }): Promise<RequestResult> {
    return call('/request', { method: 'POST', body, timeout: 60_000 });
  },

  /** The status of a library volume, with the status of every issue */
  volumeStatus(volumeId: number): Promise<
    VolumeLibraryStatus & {
      issue_list: {
        id: number;
        comicvine_id: number;
        issue_number: string;
        monitored: boolean;
        status: IssueStatus;
      }[];
    }
  > {
    return call(`/volumes/${volumeId}/status`);
  },

  libraryVolumes(sort = 'recently_added'): Promise<LibraryVolume[]> {
    return call('/volumes', { query: { sort } });
  },

  calendar(start: string, end: string, monitoredOnly = true): Promise<CalendarIssue[]> {
    return call('/calendar', { query: { start, end, monitored_only: monitoredOnly ? 'true' : 'false' } });
  },

  releases(start: string, end: string, limit = 500): Promise<ReleaseVolume[]> {
    return call('/lookup/releases', { query: { start, end, limit }, timeout: 180_000 });
  },

  async searchVolume(volumeId: number): Promise<void> {
    await call('/system/tasks', {
      method: 'POST',
      body: { cmd: 'auto_search', volume_id: volumeId },
    });
  },

  /** The cover image of a volume in the library */
  async cover(volumeId: number): Promise<Response> {
    const connection = connectionFromSettings();
    const response = await fetch(
      `${normaliseUrl(connection.url)}/api/volumes/${volumeId}/cover`,
      {
        headers: { 'X-Api-Key': connection.apiKey },
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!response.ok) {
      throw new BubblarrError('Cover not found', 'not_found', response.status);
    }
    return response;
  },
};
