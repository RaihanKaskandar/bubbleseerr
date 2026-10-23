'use client';
import useSWR from 'swr';

import { fetcher } from '@app/lib/api';

export interface SettingsData {
  appTitle: string;
  appUrl: string;
  initialized: boolean;
  bubblarrUrl: string;
  bubblarrApiKey: string;
  bubblarrRootFolderId: number | null;
  kavitaUrl: string;
  kavitaApiKey: string;
  webhookSecret: string;
  defaultPermissions: number;
  defaultPublishers: string[];
  komgaUrl: string;
  mediaServerLogin: 'none' | 'kavita' | 'komga';
  mediaServerCreateUsers: boolean;
  lastSync: number | null;
  lastSyncError: string | null;
}

export function useSettings() {
  return useSWR<SettingsData>('/api/v1/settings', fetcher);
}
