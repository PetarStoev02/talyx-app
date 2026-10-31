import type Database from 'better-sqlite3'

const OFFICE_SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, logo_path TEXT, window_view TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bots (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), name TEXT NOT NULL,
  color TEXT NOT NULL, webhook_url TEXT, grok_link TEXT
);
CREATE TABLE IF NOT EXISTS bot_groups (
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id),
  PRIMARY KEY (bot_id, group_id)
);
CREATE TABLE IF NOT EXISTS bot_t3_projects (
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  t3_project_id TEXT NOT NULL,
  PRIMARY KEY (bot_id, t3_project_id)
);
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), name TEXT NOT NULL,
  kind TEXT NOT NULL, group_id TEXT REFERENCES groups(id)
);
CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY, bot_id TEXT NOT NULL, kind TEXT NOT NULL,
  payload_json TEXT NOT NULL, at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signals_bot_at ON signals(bot_id, at);
`

/** Runs all database migrations (idempotent). */
export function runMigrations(db: Database.Database): void {
  db.exec(OFFICE_SCHEMA)
  const groupColumns = db.prepare('PRAGMA table_info(groups)').all() as { name: string }[]
  if (!groupColumns.some((c) => c.name === 'relay_bot_id')) {
    db.exec('ALTER TABLE groups ADD COLUMN relay_bot_id TEXT')
  }
}
