/**
 * The publishers people can choose to see. Used by the server (Discover,
 * Calendar) and the browser (Search filters), so no server code here.
 */
export interface Publisher {
  slug: string;
  name: string;
  /** The publisher names as ComicVine has them */
  matches: string[];
  /** White logo in public/publishers, if there is one */
  logo: string | null;
}

export const PUBLISHERS: Publisher[] = [
  { slug: 'dc', name: 'DC', matches: ['DC Comics', 'Vertigo', 'WildStorm'], logo: '/publishers/dc.png' },
  { slug: 'marvel', name: 'Marvel', matches: ['Marvel', 'Marvel Knights', 'Epic'], logo: '/publishers/marvel.png' },
  { slug: 'image', name: 'Image', matches: ['Image', 'Skybound', 'Top Cow'], logo: '/publishers/image.png' },
  { slug: 'dark-horse', name: 'Dark Horse', matches: ['Dark Horse Comics'], logo: '/publishers/dark-horse.png' },
  { slug: 'idw', name: 'IDW', matches: ['IDW Publishing'], logo: '/publishers/idw.png' },
  { slug: 'boom', name: 'BOOM!', matches: ['Boom! Studios', 'BOOM! Studios'], logo: '/publishers/boom.png' },
  { slug: 'dynamite', name: 'Dynamite', matches: ['Dynamite Entertainment'], logo: '/publishers/dynamite.png' },
  { slug: 'oni', name: 'Oni Press', matches: ['Oni Press'], logo: '/publishers/oni.png' },
  { slug: 'titan', name: 'Titan', matches: ['Titan Comics', 'Titan Books'], logo: '/publishers/titan.png' },
  { slug: 'mad-cave', name: 'Mad Cave', matches: ['Mad Cave Studios'], logo: null },
];

/** Every publisher that isn't in the list above */
export const OTHER_PUBLISHERS = 'other';

export const PUBLISHER_CHOICES = [...PUBLISHERS.map((p) => p.slug), OTHER_PUBLISHERS];

/** What people see until they (or an admin) choose */
export const DEFAULT_PUBLISHERS = ['dc', 'marvel', 'image'];

/** The choice a publisher falls under: its slug, or "other" */
export function publisherSlugOf(name: string | null): string {
  return (name && PUBLISHERS.find((p) => p.matches.includes(name))?.slug) || OTHER_PUBLISHERS;
}

export function wantsPublisher(chosen: string[], name: string | null): boolean {
  return chosen.includes(publisherSlugOf(name));
}

/** Keep only known choices, in the order of the list; never empty */
export function cleanPublisherChoice(chosen: unknown): string[] | null {
  if (!Array.isArray(chosen)) {
    return null;
  }
  const result = PUBLISHER_CHOICES.filter((slug) => chosen.includes(slug));
  return result.length ? result : null;
}

/** E.g. "DC, Marvel and Image", or "All publishers" */
export function describePublishers(chosen: string[]): string {
  if (PUBLISHER_CHOICES.every((slug) => chosen.includes(slug))) {
    return 'All publishers';
  }
  const names = chosen.map((slug) =>
    slug === OTHER_PUBLISHERS ? 'other publishers' : PUBLISHERS.find((p) => p.slug === slug)?.name ?? slug
  );
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '';
}

/**
 * Publishers of comics that aren't in English. ComicVine doesn't mark them
 * as foreign, because Japanese and French are their original languages, and
 * they would fill the release rows. Compared without accents and company
 * suffixes, by the start of the name.
 */
const NON_ENGLISH_PUBLISHERS = [
  // Japanese
  'shueisha', 'shogakukan', 'akita shoten', 'square enix', 'hakusensha', 'futabasha',
  'kadokawa', 'media factory', 'shinchosha', 'houbunsha', 'ichijinsha', 'mag garden',
  'shonen gahosha', 'tokuma shoten', 'gentosha', 'takeshobo', 'enterbrain', 'ascii media works',
  'libre', 'coamix', 'nihon bungeisha', 'leed publishing', 'seirin kogeisha', 'shodensha',
  'asahi sonorama', 'line manga', 'ohta', 'jitsugyo no nihon', 'mediaworks', 'flex comix',
  // European and Latin American
  'delcourt', 'dupuis', "vents d'ouest", 'glenat', 'dargaud', 'casterman', 'soleil',
  'le lombard', 'panini', 'carlsen', 'egmont', 'bonelli', 'editions', 'ecc ', 'norma editorial',
  'epucol', 'dino comics', 'urban comics', 'abril', 'semic', 'tm-semic', 'play press',
  'arnoldo mondadori', 'geillustreerde pers', 'reiner-feest', 'federal', 'grupo editorial',
];
/** Words that only appear in names of non-English publishers */
const NON_ENGLISH_WORDS = /\b(verlag|ediciones|editorial|edizioni|editora|editrice|forlag|forlaget|uitgeverij)\b/;
// English publishers whose names start like one of the above
const ENGLISH_EXCEPTIONS = ['kodansha comics usa', 'kodansha usa'];

function normalisePublisher(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function isEnglishPublisher(publisher: string | null): boolean {
  if (!publisher) {
    return true;
  }
  const name = normalisePublisher(publisher);
  if (ENGLISH_EXCEPTIONS.some((e) => name.startsWith(e))) {
    return true;
  }
  return !(
    name === 'kodansha' ||
    NON_ENGLISH_PUBLISHERS.some((p) => name.startsWith(p)) ||
    NON_ENGLISH_WORDS.test(name)
  );
}

/**
 * Whether a ComicVine volume is a collected edition (trade paperbacks,
 * hardcovers, omnibuses) instead of single issues. ComicVine says so in the
 * title or the first sentence of the description, like Bubblarr's Special
 * Version check.
 */
const COLLECTED_TITLE =
  /\b(tpb|hc|omnibus|compendium|deluxe edition|absolute edition|library edition|trade paperback|hardcover|graphic novel|the complete collection|collection)\b/i;
const COLLECTED_DESCRIPTION =
  /\b(trade[ -]paperbacks?|tpbs?|hard ?covers?|paperbacks?|omnibus(es)?|compendiums?|collect(s|ing|ed|ions?)|reprints?|graphic novels?)\b/i;

export function isCollectedEdition(title: string, description: string | null): boolean {
  if (COLLECTED_TITLE.test(title)) {
    return true;
  }
  const firstSentence = (description ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .trim()
    .split(/[.!?](?:\s|[A-Z]|$)/)[0];
  return COLLECTED_DESCRIPTION.test(firstSentence);
}
