import { Suspense } from 'react';

import RequestList from '@app/components/RequestList';

export default function RequestsPage() {
  return (
    <Suspense>
      <RequestList />
    </Suspense>
  );
}
