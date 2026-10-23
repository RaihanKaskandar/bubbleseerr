import { clearDiscoverCache } from '@app/server/discover';
import { json } from '@app/server/http';
import { getSettings } from '@app/server/settings';
import { handleWebhookEvent, verifySignature } from '@app/server/webhook';

/**
 * Receives Bubblarr's webhooks. Bubblarr must be set up with the URL of this
 * endpoint and the webhook secret shown in the settings.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const secret = getSettings().webhookSecret;
  if (!verifySignature(body, request.headers.get('X-Bubblarr-Signature'), secret)) {
    return json({ error: 'invalid_signature', message: 'Invalid or missing signature' }, 401);
  }

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return json({ error: 'bad_request', message: 'Invalid JSON' }, 400);
  }

  try {
    clearDiscoverCache();
    const result = await handleWebhookEvent(event);
    return json({ success: true, result });
  } catch (e) {
    console.error('Handling webhook failed:', e);
    return json({ error: 'internal_error', message: 'Handling the event failed' }, 500);
  }
}
