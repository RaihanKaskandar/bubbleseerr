import { handler, json } from '@app/server/http';
import { getSettings } from '@app/server/settings';
import { countUsers } from '@app/server/users';

export const dynamic = 'force-dynamic';

/** What the login and setup pages need to know, without logging in */
export const GET = handler(async () => {
  const settings = getSettings();
  return json({
    appTitle: settings.appTitle,
    initialized: settings.initialized,
    hasUsers: countUsers() > 0,
  });
});
