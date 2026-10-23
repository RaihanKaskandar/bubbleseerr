'use client';
// Adapted from Seerr's Layout/MobileMenu (MIT, https://github.com/seerr-team/seerr)
import { Transition } from '@headlessui/react';
import { EllipsisHorizontalIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useUser } from '@app/components/AppContext';
import { NAV_LINKS } from '@app/components/Layout/links';

/** The tab bar at the bottom of the screen on phones */
export default function MobileMenu() {
  const pathname = usePathname();
  const { hasPermission } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const links = NAV_LINKS.filter((l) => !l.requiredPermission || hasPermission(l.requiredPermission));
  // Like Seerr: up to 5 fit, otherwise 4 and a "More" button
  const visible = links.length <= 5 ? links : links.slice(0, 4);
  const more = links.length <= 5 ? [] : links.slice(4);

  useEffect(() => setIsOpen(false), [pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      // The path as it was when tapped: the tapped icon is replaced right away
      // (the dots become an X), so it's no longer inside the menu by now
      if (ref.current && !e.composedPath().includes(ref.current)) setIsOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50" aria-label="Main" ref={ref}>
      <Transition
        show={isOpen}
        as="div"
        enter="transition duration-500"
        enterFrom="opacity-0 translate-y-0"
        enterTo="opacity-100 -translate-y-full"
        leave="transition duration-500"
        leaveFrom="opacity-100 -translate-y-full"
        leaveTo="opacity-0 translate-y-0"
        className="absolute left-0 right-0 top-0 flex w-full -translate-y-full flex-col space-y-6 border-t border-gray-600 bg-gray-900/90 px-6 py-6 font-semibold text-gray-100 backdrop-blur"
      >
        {more.map((link) => {
          const active = link.activeRegExp.test(pathname);
          const Icon = active ? link.IconSelected : link.Icon;
          return (
            <Link key={link.href} href={link.href} className={`flex items-center ${active ? 'text-indigo-500' : ''}`}>
              <Icon className="h-5 w-5" />
              <span className="ml-2">{link.name}</span>
            </Link>
          );
        })}
      </Transition>
      <div className="padding-bottom-safe border-t border-gray-600 bg-gray-800/90 backdrop-blur">
        <div className="flex h-full items-center justify-between px-6 py-4 text-gray-100">
          {visible.map((link) => {
            const active = link.activeRegExp.test(pathname) && !isOpen;
            const Icon = active ? link.IconSelected : link.Icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-label={link.name}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center space-y-1 ${active ? 'text-indigo-500' : ''}`}
              >
                <Icon className="h-6 w-6" />
              </Link>
            );
          })}
          {more.length > 0 && (
            <button
              type="button"
              className={`flex flex-col items-center space-y-1 ${isOpen ? 'text-indigo-500' : ''}`}
              aria-label="More"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen((o) => !o);
              }}
              aria-expanded={isOpen}
            >
              {isOpen ? <XMarkIcon className="h-6 w-6" /> : <EllipsisHorizontalIcon className="h-6 w-6" />}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
