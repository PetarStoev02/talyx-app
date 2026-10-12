import type Database from 'better-sqlite3'
import type { WatchFolder } from '../model/WatchFolder'
import type { SortMode } from '../../sorting/model/SortMode'

interface WatchFolderRow {
  id: number
  path: string
  enabled: number
  output_path: string | null
  sort_mode: string
  created_at: string
}

function rowToWatchFolder(row: WatchFolderRow): WatchFolder {
  return {
    id: row.id,
    path: row.path,
    enabled: row.enabled === 1,
    outputPath: row.output_path,
    sortMode: row.sort_mode as SortMode,
    createdAt: row.created_at
  }
}

export class WatchFolderRepo {
  constructor(private db: Database.Database) {}

  add(folder: Omit<WatchFolder, 'id' | 'createdAt'>): WatchFolder {
    const stmt = this.db.prepare(`
      INSERT INTO watch_folders (path, enabled, output_path, sort_mode)
      VALUES (?, ?, ?, ?)
    `)

    const result = stmt.run(folder.path, folder.enabled ? 1 : 0, folder.outputPath, folder.sortMode)

    return this.getById(Number(result.lastInsertRowid))!
  }

  getById(id: number): WatchFolder | null {
    const row = this.db.prepare('SELECT * FROM watch_folders WHERE id = ?').get(id) as
      | WatchFolderRow
      | undefined

    return row ? rowToWatchFolder(row) : null
  }

  getAll(): WatchFolder[] {
    const rows = this.db
      .prepare('SELECT * FROM watch_folders ORDER BY created_at ASC')
      .all() as WatchFolderRow[]

    return rows.map(rowToWatchFolder)
  }

  getEnabled(): WatchFolder[] {
    const rows = this.db
      .prepare('SELECT * FROM watch_folders WHERE enabled = 1 ORDER BY created_at ASC')
      .all() as WatchFolderRow[]

    return rows.map(rowToWatchFolder)
  }

  setEnabled(id: number, enabled: boolean): void {
    this.db.prepare('UPDATE watch_folders SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id)
  }

  setSortMode(id: number, mode: SortMode): void {
    this.db.prepare('UPDATE watch_folders SET sort_mode = ? WHERE id = ?').run(mode, id)
  }

  remove(id: number): void {
    this.db.prepare('DELETE FROM watch_folders WHERE id = ?').run(id)
  }
}
