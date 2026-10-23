'use client';
// Adapted from Seerr's Layout/SearchInput (MIT, https://github.com/seerr-team/seerr)
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { XCircleIcon } from '@heroicons/react/24/outline';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function SearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = pathname === '/search' ? searchParams.get('query') ?? '' : '';
  const [value, setValue] = useState(urlQuery);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Follow the URL, e.g. after going back
  useEffect(() => {
    setValue(urlQuery);
  }, [urlQuery]);

  const go = (query: string) => {
    const q = query.trim();
    if (q.length >= 2) {
      const url = `/search?query=${encodeURIComponent(q)}`;
      if (pathname === '/search') {
        router.replace(url);
      } else {
        router.push(url);
      }
    }
  };

  const onChange = (next: string) => {
    setValue(next);
    clearTimeout(timer.current);
    // Search while typing, like Seerr; ComicVine is slow, so wait a bit longer
    timer.current = setTimeout(() => go(next), 600);
  };

  const clear = () => {
    setValue('');
    clearTimeout(timer.current);
    if (pathname === '/search') {
      router.push('/');
    }
  };

  return (
    <div className="flex flex-1">
      <div className="flex w-full">
        <label htmlFor="search_field" className="sr-only">
          Search
        </label>
        <div className="relative flex w-full items-center text-white focus-within:text-gray-200">
          <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
            <MagnifyingGlassIcon className="h-5 w-5" />
          </div>
          <input
            id="search_field"
            style={{ paddingRight: value.length > 0 ? '1.75rem' : '' }}
            className="block w-full rounded-full border border-gray-600 bg-gray-900/80 py-2 pl-10 text-white placeholder-gray-300 hover:border-gray-500 focus:border-gray-500 focus:bg-gray-900 focus:placeholder-gray-400 focus:outline-none focus:ring-0 sm:text-base"
            placeholder="Search comics"
            type="search"
            autoComplete="off"
            autoCapitalize="none"
            enterKeyHint="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(timer.current);
                go(value);
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          {value.length > 0 && (
            <button
              className="absolute inset-y-0 right-2 m-auto h-7 w-7 border-none p-1 text-gray-400 outline-none transition hover:text-white focus:border-none focus:outline-none"
              onClick={clear}
              aria-label="Clear search"
            >
              <XCircleIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
