/** ComicVine covers go through our proxy, which shrinks them and keeps them on disk */
export function coverSrc(url: string): string {
  return url.startsWith('https://comicvine.gamespot.com/')
    ? `/api/v1/image/cover?url=${encodeURIComponent(url)}`
    : url;
}
