import Database from 'better-sqlite3'
import log from 'electron-log'
import type { T3Project } from '../../../shared/office'

// Every snapshot push asks for names; T3 projects change rarely, so reopen the file at most once a minute.
const CACHE_MS = 60_000

/** Reads T3's project names from its state database. Read-only: Talyx never writes that file. */
export class T3Projects {
  private warned = false
  private cached: { projects: T3Project[]; at: number } | null = null

  constructor(private readonly file: string) {}

  list(): T3Project[] {
    const now = Date.now()
    if (this.cached && now - this.cached.at < CACHE_MS) return this.cached.projects
    this.cached = { projects: this.read(), at: now }
    return this.cached.projects
  }

  private read(): T3Project[] {
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
