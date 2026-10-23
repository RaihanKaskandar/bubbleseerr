/**
 * Permissions are a bitmask, like in Seerr (server/lib/permissions.ts).
 * Shared between the server and the browser.
 */
export enum Permission {
  NONE = 0,
  ADMIN = 2,
  MANAGE_SETTINGS = 4,
  MANAGE_USERS = 8,
  MANAGE_REQUESTS = 16,
  REQUEST = 32,
  /** See the requests of other users */
  REQUEST_VIEW = 64,
}

export interface PermissionCheckOptions {
  type: 'and' | 'or';
}

/**
 * Whether the permission value of a user includes the given permission(s).
 * Admins have every permission. With several permissions, by default all of
 * them are needed ('and'); use `{ type: 'or' }` to need just one.
 */
export function hasPermission(
  permissions: Permission | Permission[],
  value: number,
  options: PermissionCheckOptions = { type: 'and' }
): boolean {
  if (value & Permission.ADMIN) {
    return true;
  }

  const required = Array.isArray(permissions) ? permissions : [permissions];
  if (required.length === 0) {
    return true;
  }

  return options.type === 'and'
    ? required.every((p) => (value & p) === p)
    : required.some((p) => (value & p) === p);
}

export const DEFAULT_USER_PERMISSIONS = Permission.REQUEST;

/** The permissions that can be given in the UI, with an explanation */
export const PERMISSION_OPTIONS: {
  permission: Permission;
  name: string;
  description: string;
  /** Implied by (and so shown as checked when) one of these is set */
  parent?: Permission;
}[] = [
  {
    permission: Permission.ADMIN,
    name: 'Admin',
    description:
      'Full administrator access. Bypasses all other permission checks.',
  },
  {
    permission: Permission.MANAGE_SETTINGS,
    name: 'Manage Settings',
    description: 'Change the settings, like the connection to Bubblarr.',
    parent: Permission.ADMIN,
  },
  {
    permission: Permission.MANAGE_USERS,
    name: 'Manage Users',
    description:
      'Create, edit and delete users. Users with this permission cannot change admins or give the Admin permission.',
    parent: Permission.ADMIN,
  },
  {
    permission: Permission.MANAGE_REQUESTS,
    name: 'Manage Requests',
    description:
      'Retry and delete the requests of all users. Includes seeing all requests.',
    parent: Permission.ADMIN,
  },
  {
    permission: Permission.REQUEST,
    name: 'Request',
    description: 'Request comics. Requests are sent to Bubblarr straight away.',
    parent: Permission.ADMIN,
  },
  {
    permission: Permission.REQUEST_VIEW,
    name: 'View Requests',
    description: 'See the requests of other users.',
    parent: Permission.MANAGE_REQUESTS,
  },
];
