/**
 * Signing in with a Kavita or Komga account, like Seerr does with Plex and
 * Jellyfin. The password is checked by that server and never stored here.
 *
 * Kavita: POST /api/Account/login {username, password} gives the account
 * (401 when wrong). Komga: GET /api/v2/users/me with basic auth (email and
 * password) gives the account (401 when wrong).
 */
import { normaliseUrl } from '@app/server/bubblarr';
import { getSettings } from '@app/server/settings';

export type MediaServer = 'kavita' | 'komga';

export const MEDIA_SERVER_NAMES: Record<MediaServer, string> = {
  kavita: 'Kavita',
  komga: 'Komga',
};

export interface MediaAccount {
  server: MediaServer;
  /** Stays the same when the account is renamed, where the server allows it */
  externalId: string;
  username: string;
  email: string | null;
}

export class MediaLoginError extends Error {}

/** The server to sign in with, if signing in with one is turned on and set up */
export function mediaLoginServer(): { server: MediaServer; url: string } | null {
  const s = getSettings();
  if (s.mediaServerLogin === 'kavita' && s.kavitaUrl) {
    return { server: 'kavita', url: s.kavitaUrl };
  }
  if (s.mediaServerLogin === 'komga' && s.komgaUrl) {
    return { server: 'komga', url: s.komgaUrl };
  }
  return null;
}

async function call(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new MediaLoginError("Couldn't connect to the media server");
  }
}

async function kavitaLogin(url: string, login: string, password: string): Promise<MediaAccount | null> {
  const response = await call(`${normaliseUrl(url)}/api/Account/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: login, password, apiKey: '' }),
  });
  if (response.status === 401 || response.status === 400) {
    return null;
  }
  if (!response.ok) {
    throw new MediaLoginError(`Kavita returned HTTP ${response.status}`);
  }
  const user = (await response.json()) as { id?: number; username?: string; email?: string | null };
  if (!user.username) {
    throw new MediaLoginError('Kavita did not return the account');
  }
  return {
    server: 'kavita',
    // Older Kavita versions don't give the ID; usernames are unique too
    externalId: user.id !== undefined ? String(user.id) : user.username.toLowerCase(),
    username: user.username,
    email: user.email || null,
  };
}

async function komgaLogin(url: string, login: string, password: string): Promise<MediaAccount | null> {
  const response = await call(`${normaliseUrl(url)}/api/v2/users/me`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
      Accept: 'application/json',
    },
  });
  if (response.status === 401 || response.status === 403) {
    return null;
  }
  if (!response.ok) {
    throw new MediaLoginError(`Komga returned HTTP ${response.status}`);
  }
  const user = (await response.json()) as { id?: string; email?: string };
  if (!user.id || !user.email) {
    throw new MediaLoginError('Komga did not return the account');
  }
  return {
    server: 'komga',
    externalId: user.id,
    // Komga accounts are an email address; use the part before the @
    username: user.email.split('@')[0],
    email: user.email,
  };
}

/** Check a login with the media server; null when it's wrong */
export async function mediaLogin(
  server: MediaServer,
  url: string,
  login: string,
  password: string
): Promise<MediaAccount | null> {
  return server === 'kavita' ? kavitaLogin(url, login, password) : komgaLogin(url, login, password);
}

/** Whether the media server is reachable, for the Test button */
export async function testMediaServer(server: MediaServer, url: string): Promise<void> {
  const endpoint = `${normaliseUrl(url)}${server === 'kavita' ? '/api/health' : '/api/v2/users/me'}`;
  const response = await call(endpoint, {});
  // Komga answers 401 without a login, which also means it's there
  if (!(response.ok || (server === 'komga' && response.status === 401))) {
    throw new MediaLoginError(`${MEDIA_SERVER_NAMES[server]} returned HTTP ${response.status}`);
  }
}
