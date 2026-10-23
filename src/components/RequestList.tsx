'use client';
// Adapted from Seerr's RequestList (MIT, https://github.com/seerr-team/seerr)
import { BarsArrowDownIcon, ChevronLeftIcon, ChevronRightIcon, FunnelIcon } from '@heroicons/react/24/solid';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';

import { useUser } from '@app/components/AppContext';
import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import PageTitle from '@app/components/Common/PageTitle';
import RequestItem, { RequestItemPlaceholder } from '@app/components/RequestItem';
import { errorMessage, fetcher } from '@app/lib/api';
import { Permission } from '@app/lib/permissions';
import type { Paginated, RequestItem as Request } from '@app/lib/types';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'processing', label: 'Requested' },
  { value: 'partially_available', label: 'Partially Available' },
  { value: 'available', label: 'Available' },
  { value: 'failed', label: 'Failed' },
];
const PAGE_SIZE = 10;

export default function RequestList() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { hasPermission } = useUser();
  const filter = params.get('filter') ?? 'all';
  const page = Math.max(Number(params.get('page')) || 1, 1);
  const mine = params.get('mine') === '1';
  const canSeeAll = hasPermission([Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW], 'or');

  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) {
        next.delete(k);
      } else {
        next.set(k, v);
      }
    }
    router.replace(`${pathname}?${next.toString()}`);
  };

  const { data, error, mutate } = useSWR<Paginated<Request>>(
    `/api/v1/requests?filter=${filter}&take=${PAGE_SIZE}&page=${page}${mine ? '&mine=1' : ''}`,
    fetcher
  );

  return (
    <>
      <PageTitle title="Requests" />
      <div className="mb-4 flex flex-col justify-between lg:flex-row lg:items-end">
        <Header>{mine ? 'My Requests' : 'Requests'}</Header>
        <div className="mt-2 flex flex-grow flex-col sm:flex-row lg:flex-grow-0">
          {canSeeAll && (
            <div className="mb-2 flex flex-grow sm:mb-0 sm:mr-2 lg:flex-grow-0">
              <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
                <BarsArrowDownIcon className="h-6 w-6" />
              </span>
              <select
                aria-label="Whose requests"
                className="rounded-r-only"
                value={mine ? 'mine' : 'everyone'}
                onChange={(e) => setParam({ mine: e.target.value === 'mine' ? '1' : null, page: null })}
              >
                <option value="everyone">Everyone</option>
                <option value="mine">Only mine</option>
              </select>
            </div>
          )}
          <div className="flex flex-grow lg:flex-grow-0">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
              <FunnelIcon className="h-6 w-6" />
            </span>
            <select
              aria-label="Filter"
              className="rounded-r-only"
              value={filter}
              onChange={(e) => setParam({ filter: e.target.value, page: null })}
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <Alert type="error" title="Couldn't load the requests">{errorMessage(error)}</Alert>}
      <ul className="space-y-4">
        {!data && !error && [...Array(3)].map((_, i) => <li key={i}><RequestItemPlaceholder /></li>)}
        {data?.results.map((request) => (
          <li key={request.id}>
            <RequestItem request={request} onChange={() => void mutate()} />
          </li>
        ))}
      </ul>
      {data && data.results.length === 0 && (
        <div className="flex w-full flex-col items-center justify-center py-24 text-white">
          <span className="text-2xl text-gray-400">No requests</span>
          {filter !== 'all' && (
            <div className="mt-4">
              <Button buttonType="primary" onClick={() => setParam({ filter: null, page: null })}>
                Show All Requests
              </Button>
            </div>
          )}
        </div>
      )}
      {data && data.pageInfo.pages > 1 && (
        <div className="actions">
          <nav className="mb-3 flex flex-col items-center space-y-3 sm:flex-row sm:space-y-0" aria-label="Pagination">
            <div className="hidden lg:flex lg:flex-1">
              <p className="text-sm">
                Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, data.pageInfo.results)} of {data.pageInfo.results} results
              </p>
            </div>
            <div className="flex flex-auto justify-center space-x-2 sm:flex-1 sm:justify-end">
              <Button disabled={page <= 1} onClick={() => setParam({ page: String(page - 1) })}>
                <ChevronLeftIcon />
                <span>Previous</span>
              </Button>
              <Button disabled={page >= data.pageInfo.pages} onClick={() => setParam({ page: String(page + 1) })}>
                <span>Next</span>
                <ChevronRightIcon />
              </Button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
