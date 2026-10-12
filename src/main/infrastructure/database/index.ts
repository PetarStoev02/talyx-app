import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { runMigrations } from './migrations'

let db: Database.Database | null = null

/**
 * Returns the path to the SQLite database file in the app's user data directory.
 */
function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'talyx.db')
}

/**
 * Initializes and returns the SQLite database connection.
 * Uses WAL mode for better concurrent read/write performance.
 * Runs migrations on first initialization.
 *
 * For testing, pass an existing Database instance to skip file-based init.
 */
export function getDatabase(existingDb?: Database.Database): Database.Database {
  if (existingDb) {
    return existingDb
  }

  if (db) {
    return db
  }

  const dbPath = getDatabasePath()
  db = new Database(dbPath)

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL')

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // Run migrations
  runMigrations(db)

  return db
}

/**
 * Creates an in-memory SQLite database for testing purposes.
 * Runs migrations after creation.
 */
export function createInMemoryDatabase(): Database.Database {
  const memDb = new Database(':memory:')
  memDb.pragma('journal_mode = WAL')
  memDb.pragma('foreign_keys = ON')
  runMigrations(memDb)
  return memDb
}

/**
 * Closes the database connection gracefully.
 * Should be called when the application is shutting down.
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
