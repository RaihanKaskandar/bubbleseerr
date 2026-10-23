'use client';
import { useEffect } from 'react';

import { useAppTitle } from '@app/components/AppContext';

/** Sets the browser tab title, like Seerr's PageTitle */
export default function PageTitle({ title }: { title: string | (string | undefined | null)[] }) {
  const appTitle = useAppTitle();
  const text = Array.isArray(title) ? title.filter(Boolean).join(' - ') : title;
  useEffect(() => {
    document.title = text ? `${text} - ${appTitle}` : appTitle;
  }, [text, appTitle]);
  return null;
}
