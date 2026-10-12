import type Database from 'better-sqlite3'

/**
 * Runs all database migrations.
 * Each migration is idempotent (uses IF NOT EXISTS).
 */
export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sort_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      source_path TEXT NOT NULL,
      dest_path TEXT NOT NULL,
      operation_type TEXT NOT NULL CHECK(operation_type IN ('copy', 'move')),
      category TEXT,
      subcategory TEXT,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watch_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 1,
      output_path TEXT,
      sort_mode TEXT NOT NULL DEFAULT 'copy',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sort_operations_batch ON sort_operations(batch_id);
    CREATE INDEX IF NOT EXISTS idx_sort_operations_created ON sort_operations(created_at);
  `)

  // Migration: add rename tracking columns to sort_operations
  // Wrapped in try/catch for idempotency (column may already exist)
  try {
    db.exec(`ALTER TABLE sort_operations ADD COLUMN original_name TEXT`)
  } catch {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE sort_operations ADD COLUMN new_name TEXT`)
  } catch {
    // Column already exists
  }
  // Migration: undone batches stay in history as an audit trail instead of being deleted
  try {
    db.exec(`ALTER TABLE sort_operations ADD COLUMN undone_at TEXT`)
  } catch {
    // Column already exists
  }

  // Migration: taxonomy templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS taxonomy_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      built_in INTEGER NOT NULL DEFAULT 0,
      tree_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Migration: add metadata columns to taxonomy_templates
  for (const col of ['author TEXT', 'description TEXT', 'category TEXT', 'version TEXT']) {
    try {
      db.exec(`ALTER TABLE taxonomy_templates ADD COLUMN ${col}`)
    } catch {
      // Column already exists
    }
  }

  // Migration: document embeddings for adaptive classification
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_hash TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT,
      embedding BLOB NOT NULL,
      text_preview TEXT,
      source TEXT NOT NULL DEFAULT 'user',
      confidence REAL DEFAULT 1.0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_embeddings_category ON document_embeddings(category);
    CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON document_embeddings(file_hash);
  `)

  // Migration: classification log for future model training
  db.exec(`
    CREATE TABLE IF NOT EXISTS classification_log (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      file_extension TEXT NOT NULL,
      text_length INTEGER NOT NULL,
      detected_language TEXT,
      category TEXT NOT NULL,
      subcategory TEXT,
      confidence REAL NOT NULL,
      user_corrected_category TEXT,
      user_corrected_subcategory TEXT,
      text_features TEXT,
      template_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_classification_log_timestamp
      ON classification_log(timestamp);

    CREATE INDEX IF NOT EXISTS idx_classification_log_corrections
      ON classification_log(user_corrected_category)
      WHERE user_corrected_category IS NOT NULL;
  `)

  // Migration: scheduled sorts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_sorts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      source_path TEXT NOT NULL,
      output_path TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'copy',
      deep_analysis INTEGER NOT NULL DEFAULT 0,
      template_id TEXT,
      frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly')),
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      next_run_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Migration: FTS5 search index for file content
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS file_content_fts USING fts5(
      file_path,
      content,
      content_source,
      language
    );

    CREATE TABLE IF NOT EXISTS file_embeddings (
      file_path TEXT PRIMARY KEY,
      embedding BLOB NOT NULL,
      model_version TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  // Migration: file index for AI classification results (persistent search index)
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_index (
      rowid         INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path     TEXT UNIQUE NOT NULL,
      file_hash     TEXT NOT NULL,
      file_name     TEXT NOT NULL,
      extension     TEXT NOT NULL,
      category      TEXT,
      subcategory   TEXT,
      keywords      TEXT,
      description   TEXT,
      suggested_name TEXT,
      entities_json TEXT,
      language      TEXT DEFAULT 'en',
      file_size     INTEGER,
      indexed_at    INTEGER NOT NULL,
      source        TEXT DEFAULT 'scan'
    );

    CREATE INDEX IF NOT EXISTS idx_file_index_hash ON file_index(file_hash);
    CREATE INDEX IF NOT EXISTS idx_file_index_category ON file_index(category);
  `)

  // FTS5 virtual table for full-text search over AI classification data
  // content-sync mode: FTS mirrors file_index via triggers
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS file_index_fts USING fts5(
        keywords,
        description,
        suggested_name,
        file_name,
        content='file_index',
        content_rowid='rowid'
      )
    `)
  } catch {
    // FTS5 table already exists
  }

  // Triggers to keep FTS5 in sync with file_index
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS file_index_ai AFTER INSERT ON file_index BEGIN
      INSERT INTO file_index_fts(rowid, keywords, description, suggested_name, file_name)
      VALUES (new.rowid, new.keywords, new.description, new.suggested_name, new.file_name);
    END;

    CREATE TRIGGER IF NOT EXISTS file_index_ad AFTER DELETE ON file_index BEGIN
      INSERT INTO file_index_fts(file_index_fts, rowid, keywords, description, suggested_name, file_name)
      VALUES ('delete', old.rowid, old.keywords, old.description, old.suggested_name, old.file_name);
    END;

    CREATE TRIGGER IF NOT EXISTS file_index_au AFTER UPDATE ON file_index BEGIN
      INSERT INTO file_index_fts(file_index_fts, rowid, keywords, description, suggested_name, file_name)
      VALUES ('delete', old.rowid, old.keywords, old.description, old.suggested_name, old.file_name);
      INSERT INTO file_index_fts(rowid, keywords, description, suggested_name, file_name)
      VALUES (new.rowid, new.keywords, new.description, new.suggested_name, new.file_name);
    END;
  `)

  // Migration: scan folders for background indexing
  db.exec(`
    CREATE TABLE IF NOT EXISTS scan_folders (
      folder_path   TEXT PRIMARY KEY,
      status        TEXT DEFAULT 'pending',
      total_files   INTEGER DEFAULT 0,
      indexed_files INTEGER DEFAULT 0,
      started_at    INTEGER,
      completed_at  INTEGER
    )
  `)

  // Migration: content-addressed classification cache — keyed by file
  // fingerprint so renamed/moved files keep their classification
  db.exec(`
    CREATE TABLE IF NOT EXISTS classification_cache (
      fingerprint    TEXT PRIMARY KEY,
      category       TEXT NOT NULL,
      subcategory    TEXT,
      suggested_name TEXT,
      confidence     REAL NOT NULL,
      engine_version TEXT NOT NULL,
      source         TEXT NOT NULL CHECK (source IN ('ai', 'user-correction')),
      classified_at  INTEGER NOT NULL
    )
  `)

  // Migration: agent action log — every executed operation with its inverse,
  // the undo source for the assistant (manual sorts keep sort_operations)
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_actions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT NOT NULL,
      proposal_id TEXT NOT NULL,
      tool        TEXT NOT NULL,
      label       TEXT NOT NULL,
      payload     TEXT NOT NULL,
      inverse     TEXT,
      ok          INTEGER NOT NULL,
      error       TEXT,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_agent_actions_proposal ON agent_actions(proposal_id, id);
  `)

  // Migration: conversations — the transcript as the owner saw it, so an old
  // conversation can be reopened and continued. Swept after 30 days.
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      started_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS conversation_entries (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      kind            TEXT NOT NULL,
      payload         TEXT NOT NULL,
      created_at      INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_conversation_entries
      ON conversation_entries(conversation_id, id);
  `)

  // Migration: capture habit log — each successful overlay dump, for the Act gate
  db.exec(`
    CREATE TABLE IF NOT EXISTS capture_log (
      id          TEXT PRIMARY KEY,
      saved_at    TEXT NOT NULL,
      destination TEXT NOT NULL,
      day_key     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_capture_log_day ON capture_log(day_key);
  `)
}
