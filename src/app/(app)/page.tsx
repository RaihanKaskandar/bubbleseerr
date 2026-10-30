import { SWRConfig } from 'swr';

import PageTitle from '@app/components/Common/PageTitle';
import PublisherSlider from '@app/components/PublisherSlider';
import RecentRequestsSlider from '@app/components/RequestCard';
import MediaSlider from '@app/components/Slider';
import { preloadDiscover } from '@app/server/discover-preload';
import { getCurrentUser } from '@app/server/http';

export default async function DiscoverPage() {
  const user = await getCurrentUser();
  const fallback = user ? await preloadDiscover(user) : {};
  return (
    <SWRConfig value={{ fallback }}>
      <PageTitle title="Discover" />
      <MediaSlider
        title="New Comic Book Day"
        url="/api/v1/discover/ncbd"
        emptyMessage="ComicVine has no recent releases yet."
      />
      <MediaSlider
        title="Recently Added"
        url="/api/v1/discover/recent"
        linkUrl="/library"
        emptyMessage="Nothing in the library yet. Search for a comic to request it."
      />
      <RecentRequestsSlider />
      <MediaSlider
        title="New #1s: Great Places to Jump On"
        url="/api/v1/discover/first-issues"
        emptyMessage="No new series started recently."
      />
      <PublisherSlider />
      <MediaSlider title="Great Starting Points" url="/api/v1/discover/starters" />
      <MediaSlider title="Coming Soon in the Library" url="/api/v1/discover/upcoming" linkUrl="/calendar" hideWhenEmpty />
    </SWRConfig>
  );
}
