'use client';
// Adapted from Seerr's Layout/Sidebar (MIT, https://github.com/seerr-team/seerr)
import { Dialog, DialogPanel } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAppTitle, useUser } from '@app/components/AppContext';
import { NAV_LINKS } from '@app/components/Layout/links';
import Logo from '@app/components/Layout/Logo';

interface SidebarProps {
  open: boolean;
  setClosed: () => void;
}

export default function Sidebar({ open, setClosed }: SidebarProps) {
  const pathname = usePathname();
  const { hasPermission } = useUser();
  const appTitle = useAppTitle();
  const links = NAV_LINKS.filter((l) => !l.requiredPermission || hasPermission(l.requiredPermission));

  const renderLinks = (mobile: boolean) =>
    links.map((link) => {
      const active = link.activeRegExp.test(pathname);
      return (
        <Link
          key={link.href}
          href={link.href}
          onClick={mobile ? setClosed : undefined}
          aria-current={active ? 'page' : undefined}
          className={`group flex items-center rounded-md px-2 py-2 ${mobile ? 'text-base' : 'text-lg'} font-medium leading-6 text-white transition duration-150 ease-in-out focus:outline-none ${
            active
              ? 'bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500'
              : 'hover:bg-gray-700 focus:bg-gray-700'
          }`}
        >
          <link.Icon className="mr-3 h-6 w-6" />
          {link.name}
        </Link>
      );
    });

  return (
    <>
      {/* Slide-over on tablets */}
      <Dialog open={open} onClose={setClosed} className="relative z-40 lg:hidden">
        <div className="fixed inset-0 bg-gray-900 opacity-90" aria-hidden="true" />
        <div className="fixed inset-0 z-40 flex">
          <DialogPanel className="sidebar relative flex h-full w-full max-w-xs flex-1 flex-col bg-gray-800">
            <div className="sidebar-close-button absolute right-0 -mr-14 p-1">
              <button
                className="flex h-12 w-12 items-center justify-center rounded-full focus:bg-gray-600 focus:outline-none"
                aria-label="Close sidebar"
                onClick={setClosed}
              >
                <XMarkIcon className="h-6 w-6 text-white" />
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-4 sm:pb-4">
              <div className="flex flex-shrink-0 items-center px-6 py-4">
                <Link href="/" onClick={setClosed}>
                  <Logo title={appTitle} />
                </Link>
              </div>
              <nav className="mt-10 flex-1 space-y-4 px-4">{renderLinks(true)}</nav>
            </div>
          </DialogPanel>
          <div className="w-14 flex-shrink-0" aria-hidden="true" />
        </div>
      </Dialog>

      {/* Fixed sidebar on desktops */}
      <div className="fixed bottom-0 left-0 top-0 z-30 hidden lg:flex lg:flex-shrink-0">
        <div className="sidebar flex w-64 flex-col">
          <div className="flex h-0 flex-1 flex-col">
            <div className="flex flex-1 flex-col overflow-y-auto pb-4">
              <div className="flex h-24 flex-shrink-0 items-center px-4 py-2">
                <Link href="/" className="block">
                  <Logo title={appTitle} />
                </Link>
              </div>
              <nav className="mt-8 flex-1 space-y-4 px-4">{renderLinks(false)}</nav>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
