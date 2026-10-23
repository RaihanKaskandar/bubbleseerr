/**
 * ComicVine descriptions are HTML. Turn them into plain paragraphs (in the
 * browser), so no HTML from outside is ever put into the page.
 */
export function htmlToParagraphs(html: string | null | undefined, max = 6): string[] {
  if (!html || typeof window === 'undefined') {
    return [];
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Lists of issues/collected editions are not useful in a summary
  doc.querySelectorAll('table, figure, img, h2, h3, h4').forEach((el) => el.remove());
  const blocks = [...doc.body.querySelectorAll('p, li')]
    .map((el) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    .filter((t) => t.length > 0);
  if (blocks.length === 0) {
    const text = doc.body.textContent?.replace(/\s+/g, ' ').trim();
    return text ? [text] : [];
  }
  return blocks.slice(0, max);
}

export function formatDate(value: string | number | null | undefined, withYear = true): string {
  if (!value) {
    return 'Unknown';
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.35, 'week'],
    [12, 'month'],
    [Infinity, 'year'],
  ];
  let value = seconds;
  for (const [size, unit] of units) {
    if (Math.abs(value) < size) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(-Math.round(value), unit);
    }
    value /= size;
  }
  return '';
}
