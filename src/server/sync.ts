/**
 * Background jobs, started once per server process from instrumentation.ts.
 * Webhooks keep requests up to date right away; this is the fallback for
 * when a webhook was missed (e.g. Bubbleseerr was down).
 */
import { deleteExpiredSessions } from '@app/server/auth';
import { BubblarrError } from '@app/server/bubblarr';
import { pruneCovers } from '@app/server/covers';
import { refreshReleases } from '@app/server/discover';
import { syncRequestStatuses } from '@app/server/requests';
import { syncDueReadingLists } from '@app/server/reading-sync';
import { getSettings, updateSettings } from '@app/server/settings';

const SYNC_INTERVAL = 10 * 60 * 1000;
const FIRST_SYNC_DELAY = 15 * 1000;
const RELEASES_CHECK_INTERVAL = 15 * 60 * 1000;
const PRUNE_COVERS_INTERVAL = 24 * 60 * 60 * 1000;
const READING_SYNC_CHECK_INTERVAL = 60 * 60 * 1000;

let running = false;

export async function runSync(): Promise<number> {
  if (running) {
    return 0;
  }
  running = true;
  try {
    const settings = getSettings();
    if (!settings.initialized || !settings.bubblarrUrl) {
      return 0;
    }
    const changed = await syncRequestStatuses();
    updateSettings({ lastSync: Date.now(), lastSyncError: null });
    return changed;
  } catch (e) {
    const message =
      e instanceof BubblarrError || e instanceof Error ? e.message : String(e);
    console.warn('Syncing requests failed:', message);
    updateSettings({ lastSyncError: message });
    return 0;
  } finally {
    running = false;
  }
}

/** Keep the release rows filled, so nobody waits for ComicVine */
async function keepReleasesFresh(): Promise<void> {
  try {
    const settings = getSettings();
    if (settings.initialized && settings.bubblarrUrl) {
      await refreshReleases();
    }
  } catch (e) {
    console.warn('Refreshing the releases failed:', e);
  }
}

export function startBackgroundJobs(): void {
  const g = globalThis as unknown as { bubbleseerrJobs?: boolean };
  if (g.bubbleseerrJobs) {
    return;
  }
  g.bubbleseerrJobs = true;

  setTimeout(() => void runSync(), FIRST_SYNC_DELAY);
  setInterval(() => void runSync(), SYNC_INTERVAL);
  setTimeout(() => void keepReleasesFresh(), FIRST_SYNC_DELAY);
  setInterval(() => void keepReleasesFresh(), RELEASES_CHECK_INTERVAL);
  setInterval(() => void pruneCovers(), PRUNE_COVERS_INTERVAL);
  setInterval(() => void syncDueReadingLists(), READING_SYNC_CHECK_INTERVAL);
  setInterval(() => {
    try {
      deleteExpiredSessions();
    } catch (e) {
      console.warn('Cleaning sessions failed:', e);
    }
  }, 60 * 60 * 1000);
}
