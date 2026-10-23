/**
 * Webhooks from Bubblarr (Settings → General → Webhooks in Bubblarr).
 * Requests are signed: `X-Bubblarr-Signature: sha256=<HMAC-SHA256 of body>`.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  forgetVolumeDetails,
  markRequestsFailed,
  syncRequestStatuses,
} from '@app/server/requests';
import { scheduleKavitaScan } from '@app/server/kavita';

export function verifySignature(
  body: string,
  header: string | null,
  secret: string
): boolean {
  if (!secret || !header) {
    return false;
  }
  const expected =
    'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface WebhookEvent {
  event: string;
  volume?: { comicvine_id?: number; title?: string };
  download?: { title?: string };
}

/** Handle an event. Returns what was done, for the response and the logs. */
export async function handleWebhookEvent(event: WebhookEvent): Promise<string> {
  const comicvineId = event.volume?.comicvine_id;

  switch (event.event) {
    case 'test':
      return 'Test received';

    case 'download.failed':
      if (comicvineId) {
        forgetVolumeDetails(comicvineId);
        markRequestsFailed(
          comicvineId,
          `Download failed${event.download?.title ? `: ${event.download.title}` : ''}`
        );
      }
      return 'Marked as failed';

    case 'download.imported':
    case 'volume.added':
      if (event.event === 'download.imported') {
        // So Kavita has it before people want to read it
        scheduleKavitaScan();
      }
      if (comicvineId) {
        const changed = await syncRequestStatuses([comicvineId]);
        return `Updated ${changed} request(s)`;
      }
      return 'Nothing to update';

    default:
      return `Ignored event ${event.event}`;
  }
}
