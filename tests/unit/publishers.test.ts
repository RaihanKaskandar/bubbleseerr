import { beforeEach, describe, expect, it } from 'vitest';

import { Permission } from '@app/lib/permissions';
import {
  cleanPublisherChoice,
  describePublishers,
  isCollectedEdition,
  isEnglishPublisher,
  wantsPublisher,
} from '@app/lib/publishers';
import { toPublicUser } from '@app/server/auth';
import { updateSettings } from '@app/server/settings';
import { createUser, effectivePublishers, getUser, updateUser } from '@app/server/users';

import batmanSearch from './fixtures/batman-search.json';
import { useTestDb } from './helpers';

describe('publisher choice', () => {
  it('matches ComicVine names and imprints', () => {
    expect(wantsPublisher(['dc'], 'DC Comics')).toBe(true);
    expect(wantsPublisher(['dc'], 'Vertigo')).toBe(true);
    expect(wantsPublisher(['dc'], 'Marvel')).toBe(false);
    expect(wantsPublisher(['other'], 'Ahoy Comics')).toBe(true);
    expect(wantsPublisher(['other'], null)).toBe(true);
    expect(wantsPublisher(['dc', 'marvel'], 'Ahoy Comics')).toBe(false);
  });

  it('cleans and describes choices', () => {
    expect(cleanPublisherChoice(['image', 'nope', 'dc'])).toEqual(['dc', 'image']);
    expect(cleanPublisherChoice([])).toBeNull();
    expect(cleanPublisherChoice('dc')).toBeNull();
    expect(describePublishers(['dc', 'marvel', 'image'])).toBe('DC, Marvel and Image');
    expect(describePublishers(['dc'])).toBe('DC');
  });
});

describe('search defaults on a real "batman" search', () => {
  const results = batmanSearch as {
    comicvine_id: number;
    title: string;
    year: number;
    publisher: string;
    translated: boolean;
    description: string | null;
  }[];

  it('marks the collected editions', () => {
    const collected = results.filter((r) => isCollectedEdition(r.title, r.description)).map((r) => r.comicvine_id);
    // Tom King's, the New 52, Tynion's and Zdarsky's trade paperbacks
    for (const id of [97898, 48729, 131308, 149312]) {
      expect(collected).toContain(id);
    }
    // The ongoing series stay
    for (const id of [796, 42721, 91273, 166619]) {
      expect(collected).not.toContain(id);
    }
  });

  it('leaves only the DC single-issue runs for a DC, Marvel and Image reader', () => {
    const shown = results
      .filter(
        (r) =>
          wantsPublisher(['dc', 'marvel', 'image'], r.publisher) &&
          !r.translated &&
          isEnglishPublisher(r.publisher) &&
          !isCollectedEdition(r.title, r.description)
      )
      .sort((a, b) => b.year - a.year)
      .map((r) => `${r.title} (${r.year})`);
    expect(shown).toEqual(['Batman (2025)', 'Batman (2016)', 'Batman (2011)', 'Batman (1940)']);
  });

  it('sees foreign publishers that ComicVine does not mark', () => {
    for (const p of ['ECC Ediciones', 'Norbert Hethke Verlag', 'Edizioni Williams Inteuropa', 'Dino Comics']) {
      expect(isEnglishPublisher(p)).toBe(false);
    }
    for (const p of ['DC Comics', 'Titan Comics', 'Boom! Studios']) {
      expect(isEnglishPublisher(p)).toBe(true);
    }
  });
});

describe('publishers per user', () => {
  beforeEach(() => {
    useTestDb();
  });

  it('uses the default until chosen, and admins can choose for others', async () => {
    const owner = getUser((await createUser(null, { email: 'o@x.nl', username: 'owner', password: 'password1', permissions: Permission.ADMIN })).id)!;
    const reader = getUser((await createUser(owner, { email: 'r@x.nl', username: 'reader', password: 'password1', permissions: Permission.REQUEST })).id)!;
    expect(effectivePublishers(reader)).toEqual(['dc', 'marvel', 'image']);

    updateSettings({ defaultPublishers: ['image'] });
    expect(effectivePublishers(reader)).toEqual(['image']);

    const updated = await updateUser(owner, reader.id, { publishers: ['dc'] });
    expect(updated.publishers).toEqual(['dc']);
    expect(effectivePublishers(getUser(reader.id)!)).toEqual(['dc']);

    await updateUser(reader, reader.id, { publishers: null });
    expect(toPublicUser(getUser(reader.id)!).publishers).toBeNull();
    expect(effectivePublishers(getUser(reader.id)!)).toEqual(['image']);
  });

  it("doesn't let users change other users' publishers", async () => {
    const owner = getUser((await createUser(null, { email: 'o@x.nl', username: 'owner', password: 'password1', permissions: Permission.ADMIN })).id)!;
    const reader = getUser((await createUser(owner, { email: 'r@x.nl', username: 'reader', password: 'password1', permissions: Permission.REQUEST })).id)!;
    await expect(updateUser(reader, owner.id, { publishers: ['dc'] })).rejects.toThrow();
  });
});
