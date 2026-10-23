import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { candidateUrls, parseRatingsPage, slugify } from '@app/server/ratings';

// Saved from comicbookroundup.com in October 2026
const page = readFileSync(join(__dirname, 'fixtures', 'cbr-absolute-batman-2024.html'), 'utf8');

describe('Comic Book Roundup ratings', () => {
  it('reads critic and user ratings', () => {
    expect(parseRatingsPage(page, 'Absolute Batman', 2024)).toEqual({
      critic: { rating: 9.2, count: 422 },
      user: { rating: 8.8, count: 1377 },
    });
  });

  it('rejects a page of another series', () => {
    expect(parseRatingsPage(page, 'Batman', 2024)).toBeNull();
    expect(parseRatingsPage(page, 'Absolute Batman', 2016)).toBeNull();
  });

  it('builds the addresses to try', () => {
    expect(slugify('Ms. Marvel')).toBe('ms-marvel');
    expect(slugify('Batman & Robin')).toBe('batman-and-robin');
    expect(slugify('Batman: Bad Seeds - Streets of Gotham')).toBe('batman-bad-seeds-streets-of-gotham');
    expect(candidateUrls('The Sandman', 1989, 'DC Comics')).toEqual([
      'https://comicbookroundup.com/comic-books/reviews/dc-comics/the-sandman-(1989)',
      'https://comicbookroundup.com/comic-books/reviews/dc-comics/the-sandman',
      'https://comicbookroundup.com/comic-books/reviews/dc-comics/sandman-(1989)',
      'https://comicbookroundup.com/comic-books/reviews/dc-comics/sandman',
    ]);
    expect(candidateUrls('Saga', 2012, null)).toEqual([]);
  });
});
