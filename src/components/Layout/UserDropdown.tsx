'use client';
// Adapted from Seerr's Layout/UserDropdown (MIT, https://github.com/seerr-team/seerr)
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import {
  ArrowRightOnRectangleIcon,
  ClockIcon,
  CogIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

import { useUser } from '@app/components/AppContext';
import Avatar from '@app/components/Common/Avatar';
import { apiSend } from '@app/lib/api';

const itemClass = (focus: boolean) =>
  `flex items-center rounded px-4 py-2 text-sm font-medium text-gray-200 transition duration-150 ease-in-out ${
    focus ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white' : ''
  }`;

export default function UserDropdown() {
  const { user } = useUser();
  if (!user) {
    return null;
  }

  const logout = async () => {
    try {
      await apiSend('/api/v1/auth/logout', 'POST');
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <Menu as="div" className="relative ml-3">
      <MenuButton
        className="flex max-w-xs items-center rounded-full text-sm ring-1 ring-gray-700 hover:ring-gray-500 focus:outline-none focus:ring-gray-500"
        aria-label="User menu"
      >
        <Avatar name={user.displayName} className="h-8 w-8 text-xs sm:h-10 sm:w-10 sm:text-sm" />
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-50 mt-2 w-72 origin-top-right rounded-md shadow-lg focus:outline-none"
      >
        <div className="divide-y divide-gray-700 rounded-md bg-gray-800/80 ring-1 ring-gray-700 backdrop-blur">
          <div className="flex flex-col space-y-4 px-4 py-4">
            <div className="flex items-center space-x-2">
              <Avatar name={user.displayName} className="h-8 w-8 text-xs sm:h-10 sm:w-10 sm:text-sm" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xl font-semibold text-gray-200">{user.displayName}</span>
                <span className="truncate text-sm text-gray-400">{user.email ?? user.username}</span>
              </div>
            </div>
          </div>
          <div className="p-1">
            <MenuItem>
              {({ focus }) => (
                <Link href="/profile" className={itemClass(focus)}>
                  <UserIcon className="mr-2 inline h-5 w-5" />
                  <span>Profile</span>
                </Link>
              )}
            </MenuItem>
            <MenuItem>
              {({ focus }) => (
                <Link href="/requests?mine=1" className={itemClass(focus)}>
                  <ClockIcon className="mr-2 inline h-5 w-5" />
                  <span>My Requests</span>
                </Link>
              )}
            </MenuItem>
            <MenuItem>
              {({ focus }) => (
                <Link href="/profile#password" className={itemClass(focus)}>
                  <CogIcon className="mr-2 inline h-5 w-5" />
                  <span>Account Settings</span>
                </Link>
              )}
            </MenuItem>
            <MenuItem>
              {({ focus }) => (
                <button onClick={logout} className={`w-full ${itemClass(focus)}`}>
                  <ArrowRightOnRectangleIcon className="mr-2 inline h-5 w-5" />
                  <span>Sign Out</span>
                </button>
              )}
            </MenuItem>
          </div>
        </div>
      </MenuItems>
    </Menu>
  );
}
