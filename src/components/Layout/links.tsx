import {
  BookOpenIcon,
  CalendarDaysIcon,
  ClockIcon,
  CogIcon,
  SparklesIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import {
  BookOpenIcon as BookOpenIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
  ClockIcon as ClockIconSolid,
  CogIcon as CogIconSolid,
  SparklesIcon as SparklesIconSolid,
  UsersIcon as UsersIconSolid,
} from '@heroicons/react/24/solid';
import type React from 'react';

import { Permission } from '@app/lib/permissions';

export interface NavLink {
  href: string;
  name: string;
  Icon: React.ComponentType<{ className?: string }>;
  IconSelected: React.ComponentType<{ className?: string }>;
  activeRegExp: RegExp;
  requiredPermission?: Permission;
}

// Same menu as Seerr's sidebar, for comics
export const NAV_LINKS: NavLink[] = [
  { href: '/', name: 'Discover', Icon: SparklesIcon, IconSelected: SparklesIconSolid, activeRegExp: /^\/(search|comic\/.*|discover\/.*)?$/ },
  { href: '/library', name: 'Library', Icon: BookOpenIcon, IconSelected: BookOpenIconSolid, activeRegExp: /^\/library/ },
  { href: '/calendar', name: 'Calendar', Icon: CalendarDaysIcon, IconSelected: CalendarDaysIconSolid, activeRegExp: /^\/calendar/ },
  { href: '/requests', name: 'Requests', Icon: ClockIcon, IconSelected: ClockIconSolid, activeRegExp: /^\/requests/ },
  { href: '/users', name: 'Users', Icon: UsersIcon, IconSelected: UsersIconSolid, activeRegExp: /^\/users/, requiredPermission: Permission.MANAGE_USERS },
  { href: '/settings', name: 'Settings', Icon: CogIcon, IconSelected: CogIconSolid, activeRegExp: /^\/settings/, requiredPermission: Permission.MANAGE_SETTINGS },
];
