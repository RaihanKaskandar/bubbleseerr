import { redirect } from 'next/navigation';

import SetupWizard from '@app/components/SetupWizard';
import { toPublicUser, userHasPermission } from '@app/server/auth';
import { getCurrentUser } from '@app/server/http';
import { getSettings, getWebhookSecret } from '@app/server/settings';
import { countUsers } from '@app/server/users';
import { Permission } from '@app/lib/permissions';
import { SECRET_PLACEHOLDER } from '@app/server/settings';

export default async function SetupPage() {
  const settings = getSettings();
  if (settings.initialized) {
    redirect('/');
  }
  const hasUsers = countUsers() > 0;
  const user = await getCurrentUser();
  if (hasUsers && !userHasPermission(user, Permission.ADMIN)) {
    // The admin exists already: log in to continue the setup
    redirect('/login?next=/setup');
  }

  return (
    <SetupWizard
      appTitle={settings.appTitle}
      startStep={hasUsers ? 2 : 1}
      user={user ? toPublicUser(user) : null}
      settings={{
        bubblarrUrl: settings.bubblarrUrl,
        bubblarrApiKey: settings.bubblarrApiKey ? SECRET_PLACEHOLDER : '',
        bubblarrRootFolderId: settings.bubblarrRootFolderId,
        kavitaUrl: settings.kavitaUrl,
        kavitaApiKey: settings.kavitaApiKey ? SECRET_PLACEHOLDER : '',
        webhookSecret: hasUsers ? getWebhookSecret() : '',
      }}
    />
  );
}
