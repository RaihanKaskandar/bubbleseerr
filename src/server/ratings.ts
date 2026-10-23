/**
 * Critic and fan ratings from Comic Book Roundup (comicbookroundup.com),
 * like Seerr shows Rotten Tomatoes scores. CBR has no API, so its series
 * page is found by building its address from the publisher, title and year,
 * and read like a browser would. Results (also "not found") are cached.
 */
import { eq } from 'drizzle-orm';

import { getDb } from '@app/server/db';
import { ratings } from '@app/server/db/schema';

const BASE = 'https://comicbookroundup.com/comic-books/reviews';
const USER_AGENT = 'Mozilla/5.0 (compatible; Bubbleseerr/0.1; self-hosted comic request app)';
const FOUND_TTL = 3 * 24 * 60 * 60 * 1000;
const NOT_FOUND_TTL = 2 * 24 * 60 * 60 * 1000;

export interface Ratings {
  url: string;
  critic: { rating: number; count: number } | null;
  user: { rating: number; count: number } | null;
}

/** CBR's address part for the publishers it knows */
const PUBLISHER_SLUGS: Record<string, string> = {
  'DC Comics': 'dc-comics',
  Marvel: 'marvel-comics',
  Image: 'image-comics',
  'Dark Horse Comics': 'dark-horse-comics',
  'IDW Publishing': 'idw-publishing',
  'Boom! Studios': 'boom-studios',
  'BOOM! Studios': 'boom-studios',
  'Dynamite Entertainment': 'dynamite',
  'Mad Cave Studios': 'mad-cave-studios',
  'Oni Press': 'oni-press',
  'Titan Comics': 'titan-comics',
  'AfterShock Comics': 'aftershock-comics',
  'Vault Comics': 'vault-comics',
  'Valiant': 'valiant-comics',
  'Ahoy Comics': 'ahoy-comics',
  'Vertigo': 'vertigo',
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['’.,:!?#]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The addresses to try, most likely first */
export function candidateUrls(title: string, year: number | null, publisher: string | null): string[] {
  const pub = publisher ? PUBLISHER_SLUGS[publisher] ?? slugify(publisher) : null;
  if (!pub) {
    return [];
  }
  const slug = slugify(title);
  const slugs = [slug];
  if (slug.startsWith('the-')) {
    slugs.push(slug.slice(4));
  }
  const urls: string[] = [];
  for (const s of slugs) {
    if (year) {
      urls.push(`${BASE}/${pub}/${s}-(${year})`);
    }
    urls.push(`${BASE}/${pub}/${s}`);
  }
  return urls;
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/^the\s+/, '').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}

/** Read the ratings from a CBR series page; null when it's another comic */
export function parseRatingsPage(html: string, title: string, year: number | null): Omit<Ratings, 'url'> | null {
  // The page says which series it is in its structured data
  const name = html.match(/"itemReviewed"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/)?.[1];
  if (name) {
    const pageYear = Number(name.match(/\((\d{4})\)\s*$/)?.[1]) || null;
    const pageTitle = name.replace(/\(\d{4}\)\s*$/, '').trim();
    if (normalise(pageTitle) !== normalise(title)) {
      return null;
    }
    if (year && pageYear && Math.abs(pageYear - year) > 1) {
      return null;
    }
  }

  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  const read = (label: string) => {
    const m = text.match(new RegExp(`([0-9]+(?:\\.[0-9]+)?)\\s+${label} Rating\\s+([0-9,]+)\\s+Reviews?`));
    if (!m) return null;
    const rating = Number(m[1]);
    const count = Number(m[2].replace(/,/g, ''));
    return rating > 0 && rating <= 10 && count > 0 ? { rating, count } : null;
  };
  const critic = read('Critic');
  const user = read('User');
  return critic || user ? { critic, user } : null;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      // A redirect means CBR doesn't have this page
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    return response.status === 200 ? await response.text() : null;
  } catch {
    return null;
  }
}

/** The ratings of a comic, or null when CBR doesn't have it. Never throws. */
export async function getRatings(
  comicvineId: number,
  title: string,
  year: number | null,
  publisher: string | null
): Promise<Ratings | null> {
  const db = getDb();
  const cached = db.select().from(ratings).where(eq(ratings.comicvineId, comicvineId)).get();
  if (cached && Date.now() - cached.checkedAt < (cached.url ? FOUND_TTL : NOT_FOUND_TTL)) {
    return cached.url ? toRatings(cached) : null;
  }

  let found: Ratings | null = null;
  for (const url of candidateUrls(title, year, publisher)) {
    const html = await fetchPage(url);
    const parsed = html && parseRatingsPage(html, title, year);
    if (parsed) {
      found = { url, ...parsed };
      break;
    }
  }

  const row = {
    comicvineId,
    url: found?.url ?? null,
    criticRating: found?.critic?.rating ?? null,
    criticCount: found?.critic?.count ?? null,
    userRating: found?.user?.rating ?? null,
    userCount: found?.user?.count ?? null,
    checkedAt: Date.now(),
  };
  db.insert(ratings).values(row).onConflictDoUpdate({ target: ratings.comicvineId, set: row }).run();
  return found;
}

function toRatings(row: typeof ratings.$inferSelect): Ratings {
  return {
    url: row.url!,
    critic: row.criticRating !== null ? { rating: row.criticRating, count: row.criticCount ?? 0 } : null,
    user: row.userRating !== null ? { rating: row.userRating, count: row.userCount ?? 0 } : null,
  };
}
