import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import * as schema from '@app/server/db/schema';

/** Where the database lives. In Docker this is /app/config (a volume). */
export const CONFIG_DIR = process.env.CONFIG_DIR || join(process.cwd(), 'config');

/**
 * Migrations, run in order on startup. Never change an existing one, only
 * add new ones at the end.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    permissions INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE sessions (
    id_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comicvine_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    year INTEGER,
    publisher TEXT,
    cover_url TEXT,
    issues_spec TEXT NOT NULL,
    issues_label TEXT NOT NULL,
    status TEXT NOT NULL,
    library_status TEXT,
    bubblarr_volume_id INTEGER,
    requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX requests_comicvine_id ON requests(comicvine_id);
  CREATE INDEX requests_requested_by ON requests(requested_by);
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE kavita_links (
    comicvine_id INTEGER PRIMARY KEY,
    url TEXT,
    checked_at INTEGER NOT NULL
  );
  `,
  `
  CREATE TABLE ratings (
    comicvine_id INTEGER PRIMARY KEY,
    url TEXT,
    critic_rating REAL,
    critic_count INTEGER,
    user_rating REAL,
    user_count INTEGER,
    checked_at INTEGER NOT NULL
  );
  `,
  `
  ALTER TABLE users ADD COLUMN publishers TEXT;
  ALTER TABLE users ADD COLUMN auth_source TEXT NOT NULL DEFAULT 'local';
  ALTER TABLE users ADD COLUMN external_id TEXT;
  CREATE UNIQUE INDEX users_external ON users(auth_source, external_id);
  `,
  `
  ALTER TABLE users ADD COLUMN kavita_link_id TEXT;
  CREATE UNIQUE INDEX users_kavita_link ON users(kavita_link_id);
  `,
  `
  CREATE TABLE cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
  );
  `,
  `
  CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE COLLATE NOCASE,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    permissions INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    publishers TEXT,
    auth_source TEXT NOT NULL DEFAULT 'local',
    external_id TEXT,
    kavita_link_id TEXT
  );
  INSERT INTO users_new (
    id, email, username, display_name, password_hash, permissions, created_at,
    publishers, auth_source, external_id, kavita_link_id
  )
  SELECT
    id,
    CASE WHEN auth_source <> 'local' AND email LIKE '%.invalid' THEN NULL ELSE email END,
    username, display_name, password_hash, permissions, created_at,
    publishers, auth_source, external_id, kavita_link_id
  FROM users;
  DROP TABLE users;
  ALTER TABLE users_new RENAME TO users;
  CREATE UNIQUE INDEX users_external ON users(auth_source, external_id);
  CREATE UNIQUE INDEX users_kavita_link ON users(kavita_link_id);
  `,
];

function migrate(sqlite: Database.Database): void {
  const version = sqlite.pragma('user_version', { simple: true }) as number;
  for (let i = version; i < MIGRATIONS.length; i++) {
    sqlite.transaction(() => {
      sqlite.exec(MIGRATIONS[i]);
      const broken = sqlite.pragma('foreign_key_check') as unknown[];
      if (broken.length) {
        throw new Error(`Migration ${i + 1} left ${broken.length} rows without their parent`);
      }
      sqlite.pragma(`user_version = ${i + 1}`);
    })();
  }
}

export function openDatabase(file: string) {
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  // SQLite can only change a column by rebuilding the table. With foreign keys
  // on, dropping the old table would delete all requests and sessions of its
  // users. This does nothing inside a transaction, so it has to be out here.
  sqlite.pragma('foreign_keys = OFF');
  migrate(sqlite);
  sqlite.pragma('foreign_keys = ON');
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

export type Db = ReturnType<typeof openDatabase>['db'];

// One connection per server process. Kept on globalThis so that Next's hot
// reloading in development doesn't open a new one for every change.
const globalForDb = globalThis as unknown as {
  bubbleseerrDb?: ReturnType<typeof openDatabase>;
};

export function getDb(): Db {
  if (!globalForDb.bubbleseerrDb) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    globalForDb.bubbleseerrDb = openDatabase(
      process.env.DATABASE_FILE || join(CONFIG_DIR, 'bubbleseerr.db')
    );
  }
  return globalForDb.bubbleseerrDb.db;
}

/** Use a specific database, for tests */
export function setDb(instance: ReturnType<typeof openDatabase>): void {
  globalForDb.bubbleseerrDb = instance;
}
