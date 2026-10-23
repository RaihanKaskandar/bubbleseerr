'use client';
import React, { createContext, useContext } from 'react';

import { hasPermission, type Permission } from '@app/lib/permissions';
import { DEFAULT_PUBLISHERS } from '@app/lib/publishers';
import type { PublicUser } from '@app/lib/types';

interface AppContextValue {
  user: PublicUser | null;
  appTitle: string;
  /** The publishers the user sees (their choice or the default) */
  publishers: string[];
}

const AppContext = createContext<AppContextValue>({ user: null, appTitle: 'Bubbleseerr', publishers: DEFAULT_PUBLISHERS });

export function AppProvider({ value, children }: { value: AppContextValue; children: React.ReactNode }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useUser() {
  const { user } = useContext(AppContext);
  return {
    user,
    hasPermission: (permission: Permission | Permission[], type: 'and' | 'or' = 'and') =>
      !!user && hasPermission(permission, user.permissions, { type }),
  };
}

export function useAppTitle(): string {
  return useContext(AppContext).appTitle;
}

export function usePublishers(): string[] {
  return useContext(AppContext).publishers;
}
