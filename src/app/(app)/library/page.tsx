import { Suspense } from 'react';

import Library from '@app/components/Library';

export default function LibraryPage() {
  return (
    <Suspense>
      <Library />
    </Suspense>
  );
}
