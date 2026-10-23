import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  permissions: integer('permissions').notNull().default(0),
  /** JSON list of publisher choices (see lib/publishers); null = the default */
  publishers: text('publishers'),
  /** local, or the media server the account signs in with (kavita, komga) */
  authSource: text('auth_source').notNull().default('local'),
  /** The account on the media server */
  externalId: text('external_id'),
  createdAt: integer('created_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  idHash: text('id_hash').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const requests = sqliteTable('requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  comicvineId: integer('comicvine_id').notNull(),
  title: text('title').notNull(),
  year: integer('year'),
  publisher: text('publisher'),
  coverUrl: text('cover_url'),
  /** JSON: "all" | "future" | number[] (ComicVine issue IDs) */
  issuesSpec: text('issues_spec').notNull(),
  /** Human readable, e.g. "Whole series" or "#1, #2, #5" */
  issuesLabel: text('issues_label').notNull(),
  /** processing | partially_available | available | failed */
  status: text('status').notNull(),
  /** The status of the volume in Bubblarr, e.g. "wanted" */
  libraryStatus: text('library_status'),
  bubblarrVolumeId: integer('bubblarr_volume_id'),
  requestedBy: integer('requested_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  error: text('error'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const kavitaLinks = sqliteTable('kavita_links', {
  comicvineId: integer('comicvine_id').primaryKey(),
  url: text('url'),
  checkedAt: integer('checked_at').notNull(),
});

/** Ratings from Comic Book Roundup, cached (url null = not found) */
export const ratings = sqliteTable('ratings', {
  comicvineId: integer('comicvine_id').primaryKey(),
  url: text('url'),
  criticRating: real('critic_rating'),
  criticCount: integer('critic_count'),
  userRating: real('user_rating'),
  userCount: integer('user_count'),
  checkedAt: integer('checked_at').notNull(),
});

export type User = typeof users.$inferSelect;
export type ComicRequest = typeof requests.$inferSelect;
