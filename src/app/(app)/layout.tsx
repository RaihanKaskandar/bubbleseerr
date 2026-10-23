import { redirect } from 'next/navigation';
import type React from 'react';

import { AppProvider } from '@app/components/AppContext';
import Layout from '@app/components/Layout/Layout';
import { toPublicUser } from '@app/server/auth';
import { getCurrentUser } from '@app/server/http';
import { getSettings } from '@app/server/settings';
import { effectivePublishers } from '@app/server/users';

/** Every page with the sidebar needs a logged in user and a finished setup */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const settings = getSettings();
  if (!settings.initialized) {
    redirect('/setup');
  }
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return (
    <AppProvider value={{ user: toPublicUser(user), appTitle: settings.appTitle, publishers: effectivePublishers(user) }}>
      <Layout>{children}</Layout>
    </AppProvider>
  );
}
