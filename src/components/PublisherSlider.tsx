'use client';
// In the style of Seerr's studio/network and genre sliders (MIT, https://github.com/seerr-team/seerr)
import Link from 'next/link';
import useSWR from 'swr';

import { Slider } from '@app/components/Slider';
import { fetcher } from '@app/lib/api';
import type { PublisherTile } from '@app/server/discover';

/** Like Seerr's CompanyCard: the logo in white on a gray card */
function PublisherCard({ tile }: { tile: PublisherTile }) {
  return (
    <Link
      href={`/discover/publisher/${tile.slug}`}
      className="group relative flex h-32 w-56 scale-100 transform-gpu cursor-pointer items-center justify-center rounded-xl bg-gray-800 p-8 shadow ring-1 ring-gray-700 transition duration-300 ease-in-out hover:scale-105 hover:bg-gray-700 hover:ring-gray-500 sm:h-36 sm:w-72"
      aria-label={tile.name}
    >
      <div className="relative z-40 flex h-full w-full items-center justify-center">
        {tile.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tile.logo} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-center text-2xl font-black uppercase tracking-wider text-white sm:text-3xl">{tile.name}</span>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-0 h-12 rounded-b-xl bg-gradient-to-t from-gray-900 group-hover:from-gray-800" />
    </Link>
  );
}

export default function PublisherSlider() {
  const { data, error } = useSWR<PublisherTile[]>('/api/v1/discover/publishers', fetcher, { revalidateOnFocus: false });
  return (
    <>
      <div className="slider-header">
        <div className="slider-title">
          <span>Publishers</span>
        </div>
      </div>
      <Slider
        sliderKey="publishers"
        isLoading={!data && !error}
        isEmpty={!!error}
        emptyMessage="Couldn't load the publishers."
        items={data?.map((tile) => <PublisherCard key={tile.slug} tile={tile} />)}
      />
    </>
  );
}
