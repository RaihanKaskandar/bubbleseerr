/**
 * Hand-picked, beginner-friendly series for the "Great Starting Points" row:
 * finished or long-running stories that are easy to get into, from several
 * publishers. IDs and covers are from ComicVine.
 */
export interface Starter {
  comicvineId: number;
  title: string;
  year: number;
  publisher: string;
  volumeNumber: number;
  issueCount: number;
  coverUrl: string;
  pitch: string;
}

const CV = 'https://comicvine.gamespot.com/a/uploads/scale_small';

export const STARTERS: Starter[] = [
  { comicvineId: 46568, title: 'Saga', year: 2012, publisher: 'Image', volumeNumber: 1, issueCount: 72, coverUrl: `${CV}/10/108980/2260155-saga__1__2012_.jpg`, pitch: 'Star Wars meets Romeo and Juliet' },
  { comicvineId: 4207, title: 'The Sandman', year: 1989, publisher: 'DC Comics', volumeNumber: 2, issueCount: 75, coverUrl: `${CV}/0/9116/2199272-01.jpg`, pitch: 'The king of dreams; dark fantasy classic' },
  { comicvineId: 71457, title: 'Ms. Marvel', year: 2014, publisher: 'Marvel', volumeNumber: 3, issueCount: 19, coverUrl: `${CV}/6/67663/3619499-01a.jpg`, pitch: 'A teen from New Jersey gets powers' },
  { comicvineId: 17993, title: 'Invincible', year: 2003, publisher: 'Image', volumeNumber: 1, issueCount: 145, coverUrl: `${CV}/6/67663/2185533-01.jpg`, pitch: 'The superhero saga behind the TV show' },
  { comicvineId: 3622, title: 'Watchmen', year: 1986, publisher: 'DC Comics', volumeNumber: 1, issueCount: 12, coverUrl: `${CV}/8/80654/2184494-watchmen__1_pg_00.jpg`, pitch: '12 issues that changed superhero comics' },
  { comicvineId: 50941, title: 'Hawkeye', year: 2012, publisher: 'Marvel', volumeNumber: 2, issueCount: 22, coverUrl: `${CV}/3/31666/2696408-cover.jpg`, pitch: "An Avenger's days off; funny and stylish" },
  { comicvineId: 85128, title: 'Paper Girls', year: 2015, publisher: 'Image', volumeNumber: 1, issueCount: 30, coverUrl: `${CV}/6/67663/4842128-01.jpg`, pitch: '1988 paper girls fall into a time war' },
  { comicvineId: 121102, title: 'Something is Killing the Children', year: 2019, publisher: 'Boom! Studios', volumeNumber: 1, issueCount: 51, coverUrl: `${CV}/6/67663/7059428-01.jpg`, pitch: 'A monster hunter comes to a small town' },
  { comicvineId: 42721, title: 'Batman', year: 2011, publisher: 'DC Comics', volumeNumber: 2, issueCount: 57, coverUrl: `${CV}/6/67663/2033095-01a.jpg`, pitch: 'The modern Batman run to start with' },
  { comicvineId: 85776, title: 'Monstress', year: 2015, publisher: 'Image', volumeNumber: 1, issueCount: 64, coverUrl: `${CV}/6/67663/4894811-01.jpg`, pitch: 'Gorgeous epic fantasy' },
  { comicvineId: 27671, title: 'Sweet Tooth', year: 2009, publisher: 'DC Comics', volumeNumber: 1, issueCount: 40, coverUrl: `${CV}/6/67663/2029356-01.jpg`, pitch: 'A deer-boy in a post-apocalyptic world' },
  { comicvineId: 59366, title: 'East of West', year: 2013, publisher: 'Image', volumeNumber: 1, issueCount: 45, coverUrl: `${CV}/6/67663/2945777-01.jpg`, pitch: 'The Four Horsemen in a sci-fi western' },
];
