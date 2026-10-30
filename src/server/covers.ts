/**
 * Covers, shrunk to what the cards need and kept on disk. A ComicVine cover is
 * around 116 KB, which adds up in a row of 60 cards, and it comes from their
 * servers every time a browser doesn't have it yet.
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { bubblarr } from '@app/server/bubblarr';
import { CONFIG_DIR } from '@app/server/db';

const COVER_DIR = join(CONFIG_DIR, 'covers');
/** Twice the widest card, for sharp screens */
const COVER_WIDTH = 384;
const COVER_QUALITY = 75;
/** ComicVine's addresses change with the image, so they can stay long */
const KEEP_FOR = 30 * 24 * 60 * 60 * 1000;
/** A library cover has the same address when it changes */
const LIBRARY_COVER_MAX_AGE = 24 * 60 * 60 * 1000;

export interface Cover {
  data: Buffer;
  type: string;
}

/** Only ComicVine's images: the proxy must not fetch just any address */
export function isComicVineCover(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'comicvine.gamespot.com' &&
      parsed.pathname.startsWith('/a/uploads/')
    );
  } catch {
    return false;
  }
}

/** Null when it can't be shrunk; the original is used then */
async function shrink(image: Buffer): Promise<Buffer | null> {
  try {
    const { default: sharp } = await import('sharp');
    return await sharp(image)
      .resize({ width: COVER_WIDTH, withoutEnlargement: true })
      .webp({ quality: COVER_QUALITY })
      .toBuffer();
  } catch (e) {
    console.warn('Shrinking a cover failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function fetchAndStore(file: string, load: () => Promise<Cover>): Promise<Cover> {
  const original = await load();
  const data = await shrink(original.data);
  if (!data) {
    return original;
  }
  try {
    await mkdir(COVER_DIR, { recursive: true });
    // Never leave half a file where a reader can find it
    await writeFile(`${file}.tmp`, data);
    await rename(`${file}.tmp`, file);
  } catch (e) {
    console.warn('Storing a cover failed:', e instanceof Error ? e.message : e);
  }
  return { data, type: 'image/webp' };
}

/** A row asks for the same covers from several places at once */
const pending = new Map<string, Promise<Cover>>();

async function getCover(key: string, maxAge: number, load: () => Promise<Cover>): Promise<Cover> {
  const file = join(COVER_DIR, `${key}.webp`);
  try {
    const { mtimeMs } = await stat(file);
    if (Date.now() - mtimeMs < maxAge) {
      return { data: await readFile(file), type: 'image/webp' };
    }
  } catch {
    // Not stored yet
  }
  let running = pending.get(key);
  if (!running) {
    running = fetchAndStore(file, load).finally(() => pending.delete(key));
    pending.set(key, running);
  }
  return running;
}

export function comicVineCover(url: string): Promise<Cover> {
  const key = createHash('sha256').update(url).digest('hex').slice(0, 32);
  return getCover(key, KEEP_FOR, async () => {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      throw new Error(`ComicVine returned HTTP ${response.status}`);
    }
    return {
      data: Buffer.from(await response.arrayBuffer()),
      type: response.headers.get('Content-Type') ?? 'image/jpeg',
    };
  });
}

export function libraryCover(volumeId: number): Promise<Cover> {
  return getCover(`volume-${volumeId}`, LIBRARY_COVER_MAX_AGE, async () => {
    const response = await bubblarr.cover(volumeId);
    return {
      data: Buffer.from(await response.arrayBuffer()),
      type: response.headers.get('Content-Type') ?? 'image/jpeg',
    };
  });
}

/** Remove covers that are no longer current, so the folder doesn't keep growing */
export async function pruneCovers(): Promise<void> {
  try {
    for (const name of await readdir(COVER_DIR)) {
      const file = join(COVER_DIR, name);
      if (Date.now() - (await stat(file)).mtimeMs > KEEP_FOR) {
        await rm(file, { force: true });
      }
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('Cleaning up covers failed:', e);
    }
  }
}
