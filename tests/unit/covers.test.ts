import { readdirSync, utimesSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { dir } = vi.hoisted(() => {
  const fs = process.getBuiltinModule('node:fs');
  const path = process.getBuiltinModule('node:path');
  const os = process.getBuiltinModule('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbleseerr-covers-'));
  process.env.CONFIG_DIR = dir;
  return { dir };
});

import { comicVineCover, isComicVineCover, pruneCovers } from '@app/server/covers';

const URL_A = 'https://comicvine.gamespot.com/a/uploads/scale_small/1/1/a.jpg';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  const image = await sharp({ create: { width: 480, height: 720, channels: 3, background: '#336699' } }).jpeg().toBuffer();
  fetchMock = vi.fn(async () => new Response(new Uint8Array(image), { headers: { 'Content-Type': 'image/jpeg' } }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isComicVineCover', () => {
  it('only allows images of ComicVine', () => {
    expect(isComicVineCover(URL_A)).toBe(true);
    for (const url of [
      'http://comicvine.gamespot.com/a/uploads/a.jpg',
      'https://comicvine.gamespot.com.evil.test/a/uploads/a.jpg',
      'https://comicvine.gamespot.com@evil.test/a/uploads/a.jpg',
      'https://comicvine.gamespot.com/api/volumes/',
      'http://192.168.1.10:5657/api/volumes',
      'file:///etc/passwd',
      'nonsense',
      '',
    ]) {
      expect(isComicVineCover(url), url).toBe(false);
    }
  });
});

describe('comicVineCover', () => {
  it('shrinks a cover and fetches it only once', async () => {
    const url = `${URL_A}?first`;
    const cover = await comicVineCover(url);
    expect(cover.type).toBe('image/webp');
    expect((await sharp(cover.data).metadata()).width).toBe(384);

    expect((await comicVineCover(url)).data.equals(cover.data)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches once when several cards want the same cover', async () => {
    const url = `${URL_A}?together`;
    await Promise.all([comicVineCover(url), comicVineCover(url), comicVineCover(url)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not follow redirects', async () => {
    await comicVineCover(`${URL_A}?redirect`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error' });
  });

  it('serves the original when it can not be shrunk', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockImplementation(async () => new Response('not an image', { headers: { 'Content-Type': 'image/gif' } }));
    const cover = await comicVineCover(`${URL_A}?broken`);
    expect(cover).toMatchObject({ type: 'image/gif' });
    expect(cover.data.toString()).toBe('not an image');
  });

  it('fails when ComicVine has no such cover', async () => {
    fetchMock.mockImplementation(async () => new Response('', { status: 404 }));
    await expect(comicVineCover(`${URL_A}?missing`)).rejects.toThrow('404');
  });
});

describe('pruneCovers', () => {
  it('removes only old covers', async () => {
    await comicVineCover(`${URL_A}?old`);
    const covers = join(dir, 'covers');
    const [first] = readdirSync(covers);
    await comicVineCover(`${URL_A}?new`);

    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    utimesSync(join(covers, first), old, old);
    const before = readdirSync(covers).length;
    await pruneCovers();
    expect(readdirSync(covers)).toHaveLength(before - 1);
    expect(readdirSync(covers)).not.toContain(first);
  });
});
