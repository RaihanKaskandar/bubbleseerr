'use client';
// Adapted from Seerr's TitleCard (MIT, https://github.com/seerr-team/seerr)
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useState } from 'react';

import { useUser } from '@app/components/AppContext';
import Button from '@app/components/Common/Button';
import RequestModal from '@app/components/RequestModal';
import { StatusBadgeMini } from '@app/components/StatusBadge';
import { coverSrc } from '@app/lib/cover';
import { Permission } from '@app/lib/permissions';
import { canRequest, displayStatus } from '@app/lib/status';
import type { CardData } from '@app/server/cards';

/** Short publisher names for the pill in the corner */
function publisherLabel(publisher: string | null): string {
  if (!publisher) {
    return 'Comic';
  }
  const known: Record<string, string> = {
    'DC Comics': 'DC',
    'Marvel': 'Marvel',
    'Image': 'Image',
    'Dark Horse Comics': 'Dark Horse',
    'IDW Publishing': 'IDW',
    'Boom! Studios': 'BOOM!',
  };
  return known[publisher] ?? publisher.replace(/\s+(Comics|Publishing|Entertainment|Studios)$/i, '');
}

interface TitleCardProps {
  card: CardData;
  /** Fill the grid cell (search results) instead of a fixed width (sliders) */
  canExpand?: boolean;
  onRequested?: () => void;
}

export default function TitleCard({ card, canExpand, onRequested }: TitleCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requested, setRequested] = useState(false);
  const { hasPermission } = useUser();

  const status = requested && card.libraryStatus !== 'available' ? 'processing' : displayStatus(card.libraryStatus, card.requestStatus);
  const showRequestButton = hasPermission(Permission.REQUEST) && canRequest(status);

  return (
    <div className={canExpand ? 'w-full' : 'w-36 sm:w-36 md:w-44'} data-testid="title-card">
      {/* Only when it's open: a page has over 100 cards */}
      {showRequestModal && (
        <RequestModal
          comicvineId={card.comicvineId}
          show
          onCancel={() => setShowRequestModal(false)}
          onComplete={() => {
            setRequested(true);
            onRequested?.();
          }}
        />
      )}
      <div
        className={`relative transform-gpu cursor-default overflow-hidden rounded-xl bg-gray-800 bg-cover outline-none ring-1 transition duration-300 ${
          showDetail ? 'scale-105 shadow-lg ring-gray-500' : 'scale-100 shadow ring-gray-700'
        }`}
        style={{ paddingBottom: '150%' }}
        onMouseEnter={() => setShowDetail(true)}
        onMouseLeave={() => setShowDetail(false)}
        onFocus={() => setShowDetail(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setShowDetail(false);
          }
        }}
      >
        <div className="absolute inset-0 h-full w-full overflow-hidden">
          {card.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverSrc(card.coverUrl)} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800 p-4 text-center text-sm font-semibold text-gray-400">
              {card.title}
            </div>
          )}
          <div className="absolute left-0 right-0 flex items-center justify-between p-2">
            <div className="pointer-events-none z-40 max-w-[70%] self-start truncate rounded-full border border-purple-600 bg-purple-600/80 shadow-md">
              <div className="flex h-4 items-center truncate px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-white sm:h-5">
                <span className="truncate">{publisherLabel(card.publisher)}</span>
              </div>
            </div>
            <div className="pointer-events-none z-40 flex">
              <StatusBadgeMini status={status} />
            </div>
          </div>

          {/* Tapping the poster always opens the comic */}
          <Link
            href={`/comic/${card.comicvineId}`}
            className="absolute inset-0 z-30"
            tabIndex={-1}
            aria-hidden="true"
          />
          <div
            className={`absolute inset-0 z-30 overflow-hidden rounded-xl transition-opacity duration-150 ${
              !card.coverUrl || showDetail
                ? 'opacity-100'
                : 'pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100'
            }`}
          >
            <Link
              href={`/comic/${card.comicvineId}`}
              className="absolute inset-0 h-full w-full cursor-pointer overflow-hidden text-left"
              style={{ background: 'linear-gradient(180deg, rgba(45, 55, 72, 0.4) 0%, rgba(45, 55, 72, 0.9) 100%)' }}
              aria-label={`${card.title}${card.year ? ` (${card.year})` : ''}`}
            >
              <div className="flex h-full w-full items-end">
                <div className={`px-2 text-white ${showRequestButton ? 'pb-11' : 'pb-2'}`}>
                  {card.year && <div className="text-sm font-medium">{card.year}</div>}
                  <h1
                    className="whitespace-normal text-xl font-bold leading-tight"
                    style={{ WebkitLineClamp: 3, display: '-webkit-box', overflow: 'hidden', WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}
                  >
                    {card.title}
                  </h1>
                  <div className="whitespace-normal text-xs text-gray-200">
                    {card.subtitle ??
                      [card.volumeNumber && card.volumeNumber > 1 ? `Volume ${card.volumeNumber}` : null, card.issueCount ? `${card.issueCount} issues` : null]
                        .filter(Boolean)
                        .join(' · ')}
                  </div>
                </div>
              </div>
            </Link>
            {showRequestButton && (
              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 py-2">
                <Button buttonType="primary" buttonSize="sm" onClick={() => setShowRequestModal(true)} className="h-7 w-full">
                  <ArrowDownTrayIcon />
                  <span>Request</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* On touch screens there is no hover, so the title is shown below */}
      <p className="mt-1.5 truncate px-1 text-xs font-medium text-gray-300 [@media(hover:hover)]:hidden">{card.title}</p>
    </div>
  );
}

export function TitleCardPlaceholder({ canExpand }: { canExpand?: boolean }) {
  return (
    <div className={canExpand ? 'w-full' : 'w-36 sm:w-36 md:w-44'}>
      <div className="w-full animate-pulse rounded-xl bg-gray-700" style={{ paddingBottom: '150%' }} />
    </div>
  );
}
