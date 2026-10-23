import type { LibraryStatus, RequestStatus } from '@app/lib/types';

/** What a comic's badge shows, combining Bubblarr's status and requests */
export type DisplayStatus =
  | 'available'
  | 'partially_available'
  | 'downloading'
  | 'processing'
  | 'upcoming'
  | 'failed'
  | 'none';

export function displayStatus(
  library: LibraryStatus | string | null | undefined,
  request: RequestStatus | null | undefined
): DisplayStatus {
  switch (library) {
    case 'available':
      return 'available';
    case 'partially_available':
      return request === 'failed' ? 'failed' : 'partially_available';
    case 'downloading':
      return 'downloading';
    case 'wanted':
      return request === 'failed' ? 'failed' : 'processing';
    case 'upcoming':
      return 'upcoming';
  }
  if (request === 'failed') {
    return 'failed';
  }
  if (request === 'processing') {
    return 'processing';
  }
  return 'none';
}

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  available: 'Available',
  partially_available: 'Partially Available',
  downloading: 'Downloading',
  processing: 'Requested',
  upcoming: 'Upcoming',
  failed: 'Failed',
  none: '',
};

/** Whether there is still something to request */
export function canRequest(status: DisplayStatus): boolean {
  return status === 'none' || status === 'partially_available' || status === 'failed';
}
