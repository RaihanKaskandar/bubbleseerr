'use client';
// Adapted from Seerr's Slider and MediaSlider (MIT, https://github.com/seerr-team/seerr)
import { ArrowRightCircleIcon } from '@heroicons/react/24/outline';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import Link from 'next/link';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

import TitleCard, { TitleCardPlaceholder } from '@app/components/TitleCard';
import { errorMessage, fetcher } from '@app/lib/api';
import type { CardData } from '@app/server/cards';

interface SliderProps {
  sliderKey: string;
  items?: React.ReactNode[];
  isLoading: boolean;
  isEmpty: boolean;
  emptyMessage?: React.ReactNode;
}

export function Slider({ sliderKey, items, isLoading, isEmpty, emptyMessage }: SliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState({ isStart: true, isEnd: false });

  const update = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const isStart = el.scrollLeft <= 1;
    const isEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    // This runs for every scroll event; most of them change nothing
    setScrollPos((pos) => (pos.isStart === isStart && pos.isEnd === isEnd ? pos : { isStart, isEnd }));
  }, []);

  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [items, update]);

  const slide = (direction: 1 | -1) => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const cardWidth = el.firstElementChild?.getBoundingClientRect().width ?? 200;
    const visible = Math.max(Math.floor(el.clientWidth / cardWidth), 1);
    el.scrollBy({ left: direction * visible * cardWidth, behavior: 'smooth' });
  };

  return (
    <div className="relative" data-testid="media-slider">
      <div className="absolute right-0 -mt-10 flex text-gray-400">
        <button
          className={scrollPos.isStart ? 'text-gray-800' : 'hover:text-white'}
          onClick={() => slide(-1)}
          disabled={scrollPos.isStart}
          type="button"
          aria-label="Scroll left"
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </button>
        <button
          className={scrollPos.isEnd ? 'text-gray-800' : 'hover:text-white'}
          onClick={() => slide(1)}
          disabled={scrollPos.isEnd}
          type="button"
          aria-label="Scroll right"
        >
          <ChevronRightIcon className="h-6 w-6" />
        </button>
      </div>
      <div
        className="hide-scrollbar relative -my-2 -ml-4 -mr-4 overflow-y-auto overflow-x-scroll overscroll-x-contain whitespace-nowrap px-2 py-2"
        ref={containerRef}
        onScroll={update}
      >
        {items?.map((item, index) => (
          <div key={`${sliderKey}-${index}`} className="inline-block whitespace-normal px-2 align-top">
            {item}
          </div>
        ))}
        {isLoading &&
          [...Array(10)].map((_, i) => (
            <div key={`placeholder-${i}`} className="inline-block px-2 align-top">
              <TitleCardPlaceholder />
            </div>
          ))}
        {isEmpty && (
          <div className="mb-16 mt-16 whitespace-normal text-center font-medium text-gray-400">
            {emptyMessage ?? 'No results.'}
          </div>
        )}
      </div>
    </div>
  );
}

interface MediaSliderProps {
  title: string;
  url: string;
  linkUrl?: string;
  emptyMessage?: React.ReactNode;
  /** Hide the whole row when it has nothing to show */
  hideWhenEmpty?: boolean;
}

type SliderData = CardData[] | { title: string; results: CardData[] };

/**
 * A titled row of poster cards loaded from one of our API endpoints. The
 * endpoint returns the cards, or `{ title, results }` to set the title.
 */
export default function MediaSlider({ title: defaultTitle, url, linkUrl, emptyMessage, hideWhenEmpty }: MediaSliderProps) {
  const { data: raw, error, mutate } = useSWR<SliderData>(url, fetcher, { revalidateOnFocus: false });
  const data = raw && (Array.isArray(raw) ? raw : raw.results);
  const title = raw && !Array.isArray(raw) ? raw.title : defaultTitle;

  if (hideWhenEmpty && data && data.length === 0) {
    return null;
  }

  return (
    <>
      <div className="slider-header">
        {linkUrl ? (
          <Link href={linkUrl} className="slider-title min-w-0 pr-16">
            <span className="truncate">{title}</span>
            <ArrowRightCircleIcon />
          </Link>
        ) : (
          <div className="slider-title">
            <span>{title}</span>
          </div>
        )}
      </div>
      <Slider
        sliderKey={title}
        isLoading={!data && !error}
        isEmpty={(!!data && data.length === 0) || !!error}
        emptyMessage={error ? `Couldn't load this: ${errorMessage(error)}` : emptyMessage}
        items={data?.map((card) => (
          <TitleCard key={card.comicvineId} card={card} onRequested={() => void mutate()} />
        ))}
      />
    </>
  );
}
