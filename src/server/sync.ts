/**
 * Background jobs, started once per server process from instrumentation.ts.
 * Webhooks keep requests up to date right away; this is the fallback for
 * when a webhook was missed (e.g. Bubbleseerr was down).
 */
import { deleteExpiredSessions } from '@app/server/auth';
import { BubblarrError } from '@app/server/bubblarr';
import { syncRequestStatuses } from '@app/server/requests';
import { getSettings, updateSettings } from '@app/server/settings';

const SYNC_INTERVAL = 10 * 60 * 1000;
const FIRST_SYNC_DELAY = 15 * 1000;

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

export function startBackgroundJobs(): void {
  const g = globalThis as unknown as { bubbleseerrJobs?: boolean };
  if (g.bubbleseerrJobs) {
    return;
  }
  g.bubbleseerrJobs = true;

  setTimeout(() => void runSync(), FIRST_SYNC_DELAY);
  setInterval(() => void runSync(), SYNC_INTERVAL);
  setInterval(() => {
    try {
      deleteExpiredSessions();
    } catch (e) {
      console.warn('Cleaning sessions failed:', e);
    }
  }, 60 * 60 * 1000);
}
