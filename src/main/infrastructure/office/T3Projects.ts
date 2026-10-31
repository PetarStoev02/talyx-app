import Database from 'better-sqlite3'
import log from 'electron-log'
import type { T3Project } from '../../../shared/office'

/** Reads T3's project names from its state database. Read-only: Talyx never writes that file. */
export class T3Projects {
  private warned = false

  constructor(private readonly file: string) {}

  list(): T3Project[] {
    let db: Database.Database | null = null
    try {
      db = new Database(this.file, { readonly: true, fileMustExist: true })
      return db
        .prepare(
          'select project_id as id, title as name from projection_projects where deleted_at is null'
        )
        .all() as T3Project[]
    } catch (err) {
      // Missing T3 or a changed schema: show short ids instead of names.
      if (!this.warned) log.warn('[Office] T3 project names unavailable:', errorName(err))
      this.warned = true
      return []
    } finally {
      db?.close()
    }
  }
}

const errorName = (err: unknown): string => (err instanceof Error ? err.name : 'unknown')
