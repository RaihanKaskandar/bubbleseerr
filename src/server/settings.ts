import { randomBytes } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { DEFAULT_USER_PERMISSIONS } from '@app/lib/permissions';
import { DEFAULT_PUBLISHERS } from '@app/lib/publishers';
import { getDb } from '@app/server/db';
import { settings } from '@app/server/db/schema';

export interface AppSettings {
  initialized: boolean;
  appTitle: string;
  /** The public URL, used e.g. for the webhook URL shown in the settings */
  appUrl: string;
  bubblarrUrl: string;
  bubblarrApiKey: string;
  bubblarrRootFolderId: number | null;
  kavitaUrl: string;
  kavitaApiKey: string;
  komgaUrl: string;
  /** Let people sign in with their Kavita or Komga account */
  mediaServerLogin: 'none' | 'kavita' | 'komga';
  /** Create a Bubbleseerr account on the first sign-in with a media server account */
  mediaServerCreateUsers: boolean;
  webhookSecret: string;
  defaultPermissions: number;
  /** The publishers shown to users who didn't choose their own */
  defaultPublishers: string[];
  lastSync: number | null;
  lastSyncError: string | null;
}

const DEFAULTS: AppSettings = {
  initialized: false,
  appTitle: 'Bubbleseerr',
  appUrl: '',
  bubblarrUrl: '',
  bubblarrApiKey: '',
  bubblarrRootFolderId: null,
  kavitaUrl: '',
  kavitaApiKey: '',
  komgaUrl: '',
  mediaServerLogin: 'none',
  mediaServerCreateUsers: true,
  webhookSecret: '',
  defaultPermissions: DEFAULT_USER_PERMISSIONS,
  defaultPublishers: DEFAULT_PUBLISHERS,
  lastSync: null,
  lastSyncError: null,
};

/** Settings that must never be sent to the browser as they are */
export const SECRET_SETTINGS = [
  'bubblarrApiKey',
  'kavitaApiKey',
] as const satisfies readonly (keyof AppSettings)[];

/** What is shown in place of a secret that is set */
export const SECRET_PLACEHOLDER = '••••••••';

export function getSettings(): AppSettings {
  const rows = getDb().select().from(settings).all();
  const result: AppSettings = { ...DEFAULTS };
  for (const row of rows) {
    if (row.key in DEFAULTS) {
      (result as unknown as Record<string, unknown>)[row.key] = JSON.parse(
        row.value
      );
    }
  }
  return result;
}

export function updateSettings(values: Partial<AppSettings>): AppSettings {
  const db = getDb();
  db.transaction((tx) => {
    for (const [key, value] of Object.entries(values)) {
      if (!(key in DEFAULTS) || value === undefined) {
        continue;
      }
      const json = JSON.stringify(value);
      tx.insert(settings)
        .values({ key, value: json })
        .onConflictDoUpdate({ target: settings.key, set: { value: json } })
        .run();
    }
  });
  return getSettings();
}

/** The webhook secret, created on first use */
export function getWebhookSecret(): string {
  const current = getSettings().webhookSecret;
  if (current) {
    return current;
  }
  return regenerateWebhookSecret();
}

export function regenerateWebhookSecret(): string {
  const secret = randomBytes(24).toString('base64url');
  updateSettings({ webhookSecret: secret });
  return secret;
}

/** Remove a setting, so it goes back to its default */
export function resetSetting(key: keyof AppSettings): void {
  getDb().delete(settings).where(eq(settings.key, key)).run();
}
