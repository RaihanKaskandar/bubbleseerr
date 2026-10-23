import { redirect } from 'next/navigation';

import UserList from '@app/components/UserList';
import { Permission } from '@app/lib/permissions';
import { userHasPermission } from '@app/server/auth';
import { getCurrentUser } from '@app/server/http';

export default async function UsersPage() {
  if (!userHasPermission(await getCurrentUser(), Permission.MANAGE_USERS)) {
    redirect('/');
  }
  return <UserList />;
}
