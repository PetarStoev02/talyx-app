import type Database from 'better-sqlite3'
import type { ScheduledSort, ScheduleFrequency } from '../model/ScheduledSort'
import type { SortMode } from '../../sorting/model/SortMode'

interface ScheduledSortRow {
  id: number
  name: string
  source_path: string
  output_path: string
  mode: string
  frequency: string
  enabled: number
  last_run_at: string | null
  next_run_at: string
  created_at: string
}

function rowToModel(row: ScheduledSortRow): ScheduledSort {
  return {
    id: row.id,
    name: row.name,
    sourcePath: row.source_path,
    outputPath: row.output_path,
    mode: row.mode as SortMode,
    frequency: row.frequency as ScheduleFrequency,
    enabled: row.enabled === 1,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    createdAt: row.created_at
  }
}

export function computeNextRun(frequency: ScheduleFrequency, from?: Date): string {
  const base = from ?? new Date()
  const next = new Date(base)

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1)
      break
    case 'weekly':
      next.setDate(next.getDate() + 7)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      break
  }

  // Normalize to start of day (6:00 AM local time)
  next.setHours(6, 0, 0, 0)
  return next.toISOString()
}

/**
 * The `template_id` and `deep_analysis` columns are left in place: older versions wrote them and
 * the table keeps them. `deep_analysis` has a column default, so inserts omit it.
 */
export class ScheduledSortRepo {
  constructor(private db: Database.Database) {}

  add(schedule: Omit<ScheduledSort, 'id' | 'createdAt' | 'lastRunAt'>): ScheduledSort {
    const stmt = this.db.prepare(`
      INSERT INTO scheduled_sorts (name, source_path, output_path, mode, frequency, enabled, next_run_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      schedule.name,
      schedule.sourcePath,
      schedule.outputPath,
      schedule.mode,
      schedule.frequency,
      schedule.enabled ? 1 : 0,
      schedule.nextRunAt
    )

    return this.getById(Number(result.lastInsertRowid))!
  }

  getById(id: number): ScheduledSort | null {
    const row = this.db.prepare('SELECT * FROM scheduled_sorts WHERE id = ?').get(id) as
      | ScheduledSortRow
      | undefined
    return row ? rowToModel(row) : null
  }

  getAll(): ScheduledSort[] {
    const rows = this.db
      .prepare('SELECT * FROM scheduled_sorts ORDER BY created_at ASC')
      .all() as ScheduledSortRow[]
    return rows.map(rowToModel)
  }

  getEnabled(): ScheduledSort[] {
    const rows = this.db
      .prepare('SELECT * FROM scheduled_sorts WHERE enabled = 1 ORDER BY next_run_at ASC')
      .all() as ScheduledSortRow[]
    return rows.map(rowToModel)
  }

  getDue(): ScheduledSort[] {
    const now = new Date().toISOString()
    const rows = this.db
      .prepare(
        'SELECT * FROM scheduled_sorts WHERE enabled = 1 AND next_run_at <= ? ORDER BY next_run_at ASC'
      )
      .all(now) as ScheduledSortRow[]
    return rows.map(rowToModel)
  }

  setEnabled(id: number, enabled: boolean): void {
    this.db.prepare('UPDATE scheduled_sorts SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id)
  }

  markRun(id: number, nextRunAt: string): void {
    this.db
      .prepare(
        "UPDATE scheduled_sorts SET last_run_at = datetime('now'), next_run_at = ? WHERE id = ?"
      )
      .run(nextRunAt, id)
  }

  remove(id: number): void {
    this.db.prepare('DELETE FROM scheduled_sorts WHERE id = ?').run(id)
  }
}
