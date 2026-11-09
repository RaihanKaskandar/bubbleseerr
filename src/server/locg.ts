/**
 * Reads the public read list of a League of Comic Geeks user. LoCG has no open
 * API (its /api needs a key that isn't handed out), so this reads what its
 * site shows to anyone, without an account:
 *
 * GET /profile/<name>/read-list has the user ID in data-user.
 * GET /comic/get_comics?list=5&user_id= gives the series on the read list, with
 * how many issues were read, GET the same with series_id= gives those issues.
 * Both are JSON with the list as HTML.
 *
 * Its robots.txt asks for 30 seconds between requests, also for all our users
 * together, so everything goes through one queue and a sync takes a while.
 */
const BASE = 'https://leagueofcomicgeeks.com';
const USER_AGENT = 'Mozilla/5.0 (compatible; Bubbleseerr/0.1; self-hosted comic request app)';
const READ_LIST = '5';
const REQUEST_GAP = 31 * 1000;

export interface LocgSeries {
  id: number;
  title: string;
  year: number | null;
  publisher: string | null;
  /** How many issues of it were read */
  count: number;
}

export interface LocgProfile {
  userId: number;
  username: string;
}

export class LocgError extends Error {}

// On globalThis, so that the background jobs wait in the same queue as the routes
const g = globalThis as unknown as { bubbleseerrLocgQueue?: Promise<unknown>; bubbleseerrLocgLast?: number };

/** Wait for our turn, so requests never come closer together than REQUEST_GAP */
function inTurn<T>(request: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = (g.bubbleseerrLocgLast ?? 0) + REQUEST_GAP - Date.now();
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    g.bubbleseerrLocgLast = Date.now();
    return request();
  };
  const result = (g.bubbleseerrLocgQueue ?? Promise.resolve()).then(run, run);
  g.bubbleseerrLocgQueue = result.catch(() => undefined);
  return result;
}

function get(path: string): Promise<Response> {
  return inTurn(async () => {
    try {
      return await fetch(`${BASE}${path}`, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new LocgError("Couldn't connect to League of Comic Geeks");
    }
  });
}

/** The name from a profile link or a plain name; null when it's neither */
export function profileName(input: string): string | null {
  const text = input.trim();
  const fromUrl = text.match(/^(?:https?:\/\/)?(?:www\.)?leagueofcomicgeeks\.com\/profile\/([^/?#]+)/i);
  const name = fromUrl ? fromUrl[1] : text;
  return /^[\w.-]+$/.test(name) ? name : null;
}

function decode(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&(?:#x27|apos);/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Read the series from the HTML of a read list */
export function parseSeries(html: string): LocgSeries[] {
  return html
    .split(/<li[\s>]/)
    .slice(1)
    .flatMap((item) => {
      const id = item.match(/data-id="(\d+)"/)?.[1];
      const title = item.match(/<div class="title[^"]*">\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1];
      if (!id || !title) {
        return [];
      }
      const details = item.match(/<div class="copy-really-small[^"]*">([\s\S]*?)<\/div>/)?.[1] ?? '';
      const [publisher, year] = [...details.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map((m) => decode(m[1]));
      return [
        {
          id: Number(id),
          title: decode(title),
          year: Number(year?.match(/\d{4}/)?.[0]) || null,
          publisher: publisher || null,
          count: Number(item.match(/count-issues[^>]*>\s*(\d+)/)?.[1] ?? 0),
        },
      ];
    });
}

/** Read the issue numbers from the HTML of a series; other editions have none */
export function parseIssueNumbers(html: string): number[] {
  const numbers = html
    .split(/<li\s+id="comic-/)
    .slice(1)
    .map((item) => decode(item.match(/<div class="title[^"]*"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? ''))
    .map((title) => title.match(/#\s*(\d+(?:\.\d+)?)(?!\S*[a-z])/i)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number);
  return [...new Set(numbers)];
}

async function readList(query: Record<string, string>): Promise<{ count: number; html: string }> {
  const params = new URLSearchParams({ list: READ_LIST, view: 'list', order: 'alpha-asc', ...query });
  const response = await get(`/comic/get_comics?${params}`);
  if (!response.ok) {
    throw new LocgError(`League of Comic Geeks returned HTTP ${response.status}`);
  }
  try {
    const data = (await response.json()) as { count?: unknown; list?: unknown };
    if (typeof data.list === 'string' && typeof data.count === 'number') {
      return { count: data.count, html: data.list };
    }
  } catch {
    // Handled below, e.g. a page from Cloudflare instead of the list
  }
  throw new LocgError("League of Comic Geeks didn't return the list");
}

export async function readSeries(userId: number): Promise<LocgSeries[]> {
  const { count, html } = await readList({ list_option: 'issue', user_id: String(userId) });
  const series = parseSeries(html);
  if (count > 0 && series.length === 0) {
    throw new LocgError('The read list has a format we can not read; League of Comic Geeks may have changed');
  }
  return series;
}

export async function readIssueNumbers(userId: number, seriesId: number): Promise<number[]> {
  const { html } = await readList({
    list_option: 'series',
    user_id: String(userId),
    series_id: String(seriesId),
    view_series: '1',
  });
  return parseIssueNumbers(html);
}

/** Look up a profile from a link or a name */
export async function findProfile(input: string): Promise<LocgProfile> {
  const username = profileName(input);
  if (!username) {
    throw new LocgError("That doesn't look like a League of Comic Geeks profile");
  }
  const response = await get(`/profile/${encodeURIComponent(username)}/read-list`);
  if (response.status === 404 || response.status === 301 || response.status === 302) {
    throw new LocgError('League of Comic Geeks has no profile with this name');
  }
  if (!response.ok) {
    throw new LocgError(`League of Comic Geeks returned HTTP ${response.status}`);
  }
  const userId = (await response.text()).match(/data-user="(\d+)"/)?.[1];
  if (!userId) {
    throw new LocgError('This profile can not be read; is it public?');
  }
  return { userId: Number(userId), username };
}
