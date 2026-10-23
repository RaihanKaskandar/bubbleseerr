'use client';
// Adapted from Seerr's Layout (MIT, https://github.com/seerr-team/seerr)
import { ArrowLeftIcon, Bars3BottomLeftIcon } from '@heroicons/react/24/solid';
import { usePathname, useRouter } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';

import MobileMenu from '@app/components/Layout/MobileMenu';
import SearchInput from '@app/components/Layout/SearchInput';
import Sidebar from '@app/components/Layout/Sidebar';
import UserDropdown from '@app/components/Layout/UserDropdown';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const update = () => setIsScrolled(window.pageYOffset > 20);
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-full min-h-full min-w-0 bg-gray-900">
      <div className="pwa-only fixed inset-0 z-20 h-1 w-full border-gray-700 md:border-t" />
      <div className="absolute-top-glow absolute h-64 w-full bg-gradient-to-bl from-gray-800 to-gray-900">
        <div className="relative inset-0 h-full w-full bg-gradient-to-t from-gray-900 to-transparent" />
        {/* Starts in the status bar's color (theme-color), so the iPhone status bar has no edge */}
        <div className="status-bar-fade absolute inset-x-0 top-0" />
      </div>
      <Sidebar open={isSidebarOpen} setClosed={() => setSidebarOpen(false)} />
      <div className="sm:hidden">
        <MobileMenu />
      </div>

      <div className="relative mb-16 flex w-0 min-w-0 flex-1 flex-col lg:ml-64">
        <div
          className={`searchbar fixed left-0 right-0 top-0 z-10 flex flex-shrink-0 transition duration-300 ${
            isScrolled ? 'bg-gray-700/80' : 'bg-transparent'
          } lg:left-64`}
          style={{
            backdropFilter: isScrolled ? 'blur(5px)' : undefined,
            WebkitBackdropFilter: isScrolled ? 'blur(5px)' : undefined,
          }}
        >
          <div className="flex flex-1 items-center justify-between px-4 md:pl-4 md:pr-4">
            <button
              className={`mr-2 hidden text-white sm:block ${isScrolled ? 'opacity-90' : 'opacity-70'} transition duration-300 focus:outline-none lg:hidden`}
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
            >
              <Bars3BottomLeftIcon className="h-7 w-7" />
            </button>
            <button
              className={`mr-2 text-white ${isScrolled ? 'opacity-90' : 'opacity-70'} pwa-only transition duration-300 hover:text-white focus:text-white focus:outline-none`}
              onClick={() => router.back()}
              aria-label="Go back"
            >
              <ArrowLeftIcon className="w-7" />
            </button>
            <Suspense fallback={<div className="flex-1" />}>
              <SearchInput />
            </Suspense>
            <div className="flex items-center">
              <UserDropdown />
            </div>
          </div>
        </div>

        <main className="relative top-16 z-0 focus:outline-none" tabIndex={-1}>
          <div className="mb-6">
            <div className="mx-auto max-w-8xl px-4">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
