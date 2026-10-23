import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import LoginForm from '@app/components/LoginForm';
import { getCurrentUser } from '@app/server/http';
import { MEDIA_SERVER_NAMES, mediaLoginServer } from '@app/server/media-login';
import { getSettings } from '@app/server/settings';
import { countUsers } from '@app/server/users';

export default async function LoginPage() {
  const settings = getSettings();
  // Before the admin exists, there is nobody to log in as
  if (countUsers() === 0) {
    redirect('/setup');
  }
  if (await getCurrentUser()) {
    redirect('/');
  }
  const media = mediaLoginServer();
  return (
    <Suspense>
      <LoginForm appTitle={settings.appTitle} mediaServer={media ? MEDIA_SERVER_NAMES[media.server] : null} />
    </Suspense>
  );
}
