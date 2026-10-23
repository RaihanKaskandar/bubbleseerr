import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  serverExternalPackages: ['better-sqlite3'],
  images: {
    // ComicVine covers are public; library covers go through our own proxy
    remotePatterns: [
      { protocol: 'https', hostname: 'comicvine.gamespot.com' },
    ],
  },
};

export default nextConfig;
