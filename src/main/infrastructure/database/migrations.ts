import type Database from 'better-sqlite3'

/** Runs all database migrations. The office schema arrives with the office domain. */
export function runMigrations(db: Database.Database): void {
  void db
}
