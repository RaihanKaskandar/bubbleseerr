import { redirect } from 'next/navigation';
import type React from 'react';

import SettingsLayout from '@app/components/Settings/SettingsLayout';
import { Permission } from '@app/lib/permissions';
import { userHasPermission } from '@app/server/auth';
import { getCurrentUser } from '@app/server/http';

export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!userHasPermission(await getCurrentUser(), Permission.MANAGE_SETTINGS)) {
    redirect('/');
  }
  return <SettingsLayout>{children}</SettingsLayout>;
}
