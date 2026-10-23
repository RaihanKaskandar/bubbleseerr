import { Suspense } from 'react';

import SearchResults from '@app/components/SearchResults';

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
