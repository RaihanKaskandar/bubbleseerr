'use client';
// Adapted from Seerr's RequestCard (MIT, https://github.com/seerr-team/seerr)
import Link from 'next/link';
import useSWR from 'swr';

import Avatar from '@app/components/Common/Avatar';
import { Slider } from '@app/components/Slider';
import StatusBadge from '@app/components/StatusBadge';
import { fetcher } from '@app/lib/api';
import { coverSrc } from '@app/lib/cover';
import { displayStatus } from '@app/lib/status';
import type { Paginated, RequestItem } from '@app/lib/types';

export function RequestCard({ request }: { request: RequestItem }) {
  const status = displayStatus(request.libraryStatus, request.status);
  return (
    <div className="relative flex w-72 overflow-hidden rounded-xl bg-gray-800 bg-cover bg-center p-4 text-gray-400 shadow ring-1 ring-gray-700 sm:w-96">
      {request.coverUrl && (
        <div className="absolute inset-0 z-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverSrc(request.coverUrl)} alt="" loading="lazy" className="h-full w-full scale-125 object-cover blur-sm" />
          <div
            className="absolute inset-0"
            style={{ backgroundImage: 'linear-gradient(135deg, rgba(17, 24, 39, 0.47) 0%, rgba(17, 24, 39, 1) 75%)' }}
          />
        </div>
      )}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col pr-4">
        <div className="hidden text-xs font-medium text-white sm:flex">{request.year}</div>
        <Link
          href={`/comic/${request.comicvineId}`}
          className="overflow-hidden overflow-ellipsis whitespace-nowrap text-base font-bold text-white hover:underline sm:text-lg"
        >
          {request.title}
        </Link>
        <div className="card-field">
          <span className="group flex items-center">
            <Avatar name={request.requestedByUser.displayName} className="mr-1 h-5 w-5 text-[9px]" />
            <span className="truncate font-semibold group-hover:text-white">{request.requestedByUser.displayName}</span>
          </span>
        </div>
        <div className="my-0.5 hidden items-center text-sm sm:my-1 sm:flex">
          <span className="mr-2 font-bold">Issues</span>
          <span className="truncate">{request.issuesLabel}</span>
        </div>
        <div className="mt-2 flex items-center text-sm sm:mt-1">
          <span className="mr-2 hidden font-bold sm:block">Status</span>
          <StatusBadge status={status === 'none' ? 'processing' : status} />
        </div>
      </div>
      <Link
        href={`/comic/${request.comicvineId}`}
        className="w-20 flex-shrink-0 scale-100 transform-gpu cursor-pointer overflow-hidden rounded-md shadow-sm transition duration-300 hover:scale-105 hover:shadow-md sm:w-28"
      >
        {request.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverSrc(request.coverUrl)} alt="" loading="lazy" className="aspect-[2/3] w-full object-cover" />
        ) : (
          <div className="aspect-[2/3] w-full bg-gray-700" />
        )}
      </Link>
    </div>
  );
}

function RequestCardPlaceholder() {
  return (
    <div className="relative w-72 animate-pulse rounded-xl bg-gray-700 p-4 sm:w-96">
      <div className="w-20 sm:w-28">
        <div className="w-full" style={{ paddingBottom: '150%' }} />
      </div>
    </div>
  );
}

/** The "Recent Requests" row of Seerr's Discover page */
export default function RecentRequestsSlider() {
  const { data, error } = useSWR<Paginated<RequestItem>>('/api/v1/requests?take=10', fetcher);
  if (data && data.results.length === 0) {
    return null;
  }
  return (
    <>
      <div className="slider-header">
        <Link href="/requests" className="slider-title min-w-0 pr-16">
          <span className="truncate">Recent Requests</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m12.75 15 3-3m0 0-3-3m3 3h-7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </Link>
      </div>
      {!data && !error ? (
        <div className="hide-scrollbar -mx-4 flex gap-4 overflow-hidden px-4">
          {[...Array(3)].map((_, i) => <RequestCardPlaceholder key={i} />)}
        </div>
      ) : (
        <Slider
          sliderKey="requests"
          isLoading={false}
          isEmpty={!!error}
          emptyMessage="Couldn't load the requests."
          items={data?.results.map((r) => <RequestCard key={r.id} request={r} />)}
        />
      )}
    </>
  );
}
