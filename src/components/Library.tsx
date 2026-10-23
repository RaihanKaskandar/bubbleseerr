'use client';
// In the style of Seerr's lists (MIT, https://github.com/seerr-team/seerr)
import { BarsArrowDownIcon, FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

import Alert from '@app/components/Common/Alert';
import Header from '@app/components/Common/Header';
import PageTitle from '@app/components/Common/PageTitle';
import TitleCard, { TitleCardPlaceholder } from '@app/components/TitleCard';
import { errorMessage, fetcher } from '@app/lib/api';
import type { CardData } from '@app/server/cards';

type LibraryCard = CardData & { downloaded: number; addedOrder: number };

const FILTERS: Record<string, { label: string; test: (c: LibraryCard) => boolean }> = {
  all: { label: 'All Comics', test: () => true },
  available: { label: 'Available', test: (c) => c.libraryStatus === 'available' },
  partial: { label: 'Partially Available', test: (c) => c.libraryStatus === 'partially_available' },
  wanted: { label: 'Not Downloaded Yet', test: (c) => c.downloaded === 0 },
};

const SORTS: Record<string, { label: string; compare: (a: LibraryCard, b: LibraryCard) => number }> = {
  added: { label: 'Recently Added', compare: (a, b) => a.addedOrder - b.addedOrder },
  title: { label: 'Title', compare: (a, b) => a.title.localeCompare(b.title) || (a.year ?? 0) - (b.year ?? 0) },
  publisher: { label: 'Publisher', compare: (a, b) => (a.publisher ?? '').localeCompare(b.publisher ?? '') || a.title.localeCompare(b.title) },
  year: { label: 'Newest Series', compare: (a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title) },
};

export default function Library() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filter = params.get('filter') && FILTERS[params.get('filter')!] ? params.get('filter')! : 'all';
  const sort = params.get('sort') && SORTS[params.get('sort')!] ? params.get('sort')! : 'added';
  const [text, setText] = useState('');
  const { data, error, mutate } = useSWR<LibraryCard[]>('/api/v1/library', fetcher);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const results = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return (data ?? [])
      .filter(FILTERS[filter].test)
      .filter((c) => !needle || c.title.toLowerCase().includes(needle) || (c.publisher ?? '').toLowerCase().includes(needle))
      .sort(SORTS[sort].compare);
  }, [data, filter, sort, text]);

  return (
    <>
      <PageTitle title="Library" />
      <div className="mb-4 flex flex-col justify-between lg:flex-row lg:items-end">
        <Header subtext={data ? `${results.length} of ${data.length} comics` : undefined}>Library</Header>
        <div className="mt-2 flex flex-grow flex-col gap-2 sm:flex-row lg:flex-grow-0">
          <div className="flex flex-grow lg:flex-grow-0">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
              <MagnifyingGlassIcon className="h-6 w-6" />
            </span>
            <input
              type="search"
              aria-label="Filter by name"
              placeholder="Filter by name"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="block w-full min-w-0 flex-1 rounded-md rounded-l-none border border-gray-500 bg-gray-700 text-white sm:w-48 sm:text-sm"
            />
          </div>
          <div className="flex flex-grow lg:flex-grow-0">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
              <FunnelIcon className="h-6 w-6" />
            </span>
            <select aria-label="Filter" className="rounded-r-only" value={filter} onChange={(e) => setParam('filter', e.target.value)}>
              {Object.entries(FILTERS).map(([k, f]) => (
                <option key={k} value={k}>{f.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-grow lg:flex-grow-0">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
              <BarsArrowDownIcon className="h-6 w-6" />
            </span>
            <select aria-label="Sort" className="rounded-r-only" value={sort} onChange={(e) => setParam('sort', e.target.value)}>
              {Object.entries(SORTS).map(([k, s]) => (
                <option key={k} value={k}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <Alert type="error" title="Couldn't load the library">{errorMessage(error)}</Alert>}
      {!error && (
        <ul className="cards-vertical">
          {data
            ? results.map((card) => (
                <li key={card.comicvineId}>
                  <TitleCard card={card} canExpand onRequested={() => void mutate()} />
                </li>
              ))
            : [...Array(18)].map((_, i) => (
                <li key={i}>
                  <TitleCardPlaceholder canExpand />
                </li>
              ))}
        </ul>
      )}
      {data && results.length === 0 && (
        <div className="py-24 text-center text-2xl text-gray-400">No comics match</div>
      )}
    </>
  );
}
