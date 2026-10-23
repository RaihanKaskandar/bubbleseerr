'use client';
// Adapted from Seerr's SettingsLayout and SettingsTabs (MIT, https://github.com/seerr-team/seerr)
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type React from 'react';

import Header from '@app/components/Common/Header';
import PageTitle from '@app/components/Common/PageTitle';

const ROUTES = [
  { text: 'General', route: '/settings', regex: /^\/settings\/?$/ },
  { text: 'Bubblarr', route: '/settings/bubblarr', regex: /^\/settings\/bubblarr/ },
  { text: 'Kavita', route: '/settings/kavita', regex: /^\/settings\/kavita/ },
  { text: 'Users', route: '/settings/users', regex: /^\/settings\/users/ },
  { text: 'Webhook', route: '/settings/webhook', regex: /^\/settings\/webhook/ },
  { text: 'About', route: '/settings/about', regex: /^\/settings\/about/ },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = ROUTES.find((r) => r.regex.test(pathname));

  return (
    <>
      <PageTitle title={['Settings', current?.text]} />
      <Header>Settings</Header>
      <div className="mt-6">
        <div className="sm:hidden">
          <label htmlFor="tabs" className="sr-only">Select a Tab</label>
          <select id="tabs" value={current?.route} onChange={(e) => router.push(e.target.value)} aria-label="Selected Tab">
            {ROUTES.map((r) => (
              <option key={r.route} value={r.route}>{r.text}</option>
            ))}
          </select>
        </div>
        <div className="hide-scrollbar hidden overflow-x-scroll border-b border-gray-600 sm:block">
          <nav className="flex">
            {ROUTES.map((r) => {
              const active = r.regex.test(pathname);
              return (
                <Link
                  key={r.route}
                  href={r.route}
                  aria-current={active ? 'page' : undefined}
                  className={`ml-8 whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium leading-5 transition duration-300 first:ml-0 ${
                    active
                      ? 'border-indigo-600 text-indigo-500'
                      : 'border-transparent text-gray-500 hover:border-gray-400 hover:text-gray-300 focus:border-gray-400 focus:text-gray-300'
                  }`}
                >
                  {r.text}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <div className="mt-10 text-white">{children}</div>
    </>
  );
}
