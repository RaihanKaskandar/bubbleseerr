'use client';
// In the style of Seerr's studio and network pages (MIT, https://github.com/seerr-team/seerr)
import useSWR from 'swr';

import Alert from '@app/components/Common/Alert';
import Header from '@app/components/Common/Header';
import PageTitle from '@app/components/Common/PageTitle';
import TitleCard, { TitleCardPlaceholder } from '@app/components/TitleCard';
import { errorMessage, fetcher } from '@app/lib/api';
import type { CardData } from '@app/server/cards';

export default function PublisherPage({ slug }: { slug: string }) {
  const { data, error, mutate } = useSWR<{ name: string; results: CardData[] }>(`/api/v1/discover/publisher/${slug}`, fetcher, {
    revalidateOnFocus: false,
  });
  return (
    <>
      <PageTitle title={data?.name ?? 'Publisher'} />
      <Header subtext={data ? `${data.results.length} series with new issues in the last weeks, newest first` : undefined}>
        {data ? `${data.name} Comics` : 'Loading...'}
      </Header>
      {error && (
        <div className="mt-6">
          <Alert type="error" title="Couldn't load this publisher">{errorMessage(error)}</Alert>
        </div>
      )}
      {!error && (
        <ul className="cards-vertical mt-6">
          {data
            ? data.results.map((card) => (
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
    </>
  );
}
