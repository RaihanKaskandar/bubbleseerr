import '@fontsource-variable/inter';
import '@app/styles/globals.css';

import type { Metadata, Viewport } from 'next';
import type React from 'react';

import Toaster from '@app/components/Common/Toaster';
import { getSettings } from '@app/server/settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { appTitle } = getSettings();
  return {
    title: appTitle,
    description: 'Request comics',
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: appTitle, statusBarStyle: 'black-translucent' },
    // Next only writes mobile-web-app-capable; iPhones need Apple's own tag to
    // open the home screen app full screen, under a see-through status bar
    other: { 'apple-mobile-web-app-capable': 'yes' },
    // Listing them all: setting any icon here turns off Next's automatic favicon
    icons: {
      icon: [
        { url: '/logo.svg', type: 'image/svg+xml' },
        { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#111827',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-900 font-sans text-gray-300 antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
