import type Database from 'better-sqlite3'
import type { SortOperation } from '../model/SortOperation'
import type { SortBatch } from '../model/SortBatch'
import type { SortMode } from '../model/SortMode'

/**
 * Raw row shape returned from the sort_operations table.
 */
interface SortOperationRow {
  id: number
  batch_id: string
  source_path: string
  dest_path: string
  operation_type: string
  category: string | null
  subcategory: string | null
  file_name: string
  file_size: number | null
  created_at: string
}

/**
 * Maps a database row to a SortOperation domain model.
 */
function rowToOperation(row: SortOperationRow): SortOperation {
  return {
    id: row.id,
    batchId: row.batch_id,
    sourcePath: row.source_path,
    destPath: row.dest_path,
    operationType: row.operation_type as SortMode,
    category: row.category,
    subcategory: row.subcategory,
    fileName: row.file_name,
    fileSize: row.file_size,
    createdAt: row.created_at
  }
}

/**
 * Repository for managing sort operation history in the SQLite database.
 */
export class SortHistoryRepo {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  /**
   * Records a single sort operation in the database.
   */
  recordOperation(op: SortOperation): void {
    const stmt = this.db.prepare(`
      INSERT INTO sort_operations (batch_id, source_path, dest_path, operation_type, category, subcategory, file_name, file_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      op.batchId,
      op.sourcePath,
      op.destPath,
      op.operationType,
      op.category,
      op.subcategory,
      op.fileName,
      op.fileSize,
      op.createdAt
    )
  }

  /**
   * Retrieves sort history grouped by batch_id, ordered by most recent first.
   * Returns an array of SortBatch objects with pagination support.
   */
  getHistory(limit: number, offset: number): SortBatch[] {
    // First, get the distinct batch IDs with pagination
    const batchRows = this.db
      .prepare(
        `
      SELECT batch_id, MIN(created_at) as first_created, MAX(undone_at) as undone_at
      FROM sort_operations
      GROUP BY batch_id
      ORDER BY first_created DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(limit, offset) as { batch_id: string; first_created: string; undone_at: string | null }[]

    // For each batch, get all operations
    const batches: SortBatch[] = batchRows.map((batchRow) => {
      const operations = this.getBatchOperations(batchRow.batch_id)
      return {
        batchId: batchRow.batch_id,
        operations,
        timestamp: sqliteUtcToDate(batchRow.first_created),
        totalFiles: operations.length,
        undoneAt: batchRow.undone_at ? sqliteUtcToDate(batchRow.undone_at).toISOString() : null
      }
    })

    return batches
  }

  /** Stamps every operation in the batch as undone — history keeps the audit trail */
  markUndone(batchId: string): void {
    this.db
      .prepare(`UPDATE sort_operations SET undone_at = datetime('now') WHERE batch_id = ?`)
      .run(batchId)
  }

  isUndone(batchId: string): boolean {
    const row = this.db
      .prepare('SELECT MAX(undone_at) as undone_at FROM sort_operations WHERE batch_id = ?')
      .get(batchId) as { undone_at: string | null } | undefined
    return row?.undone_at != null
  }

  /**
   * Retrieves all sort operations for a given batch ID.
   */
  getBatchOperations(batchId: string): SortOperation[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM sort_operations
      WHERE batch_id = ?
      ORDER BY created_at ASC
    `
      )
      .all(batchId) as SortOperationRow[]

    return rows.map(rowToOperation)
  }

  /**
   * Deletes all sort operations for a given batch ID.
   */
  deleteBatch(batchId: string): void {
    this.db.prepare('DELETE FROM sort_operations WHERE batch_id = ?').run(batchId)
  }

  clearAll(): void {
    this.db.prepare('DELETE FROM sort_operations').run()
  }
}

/**
 * Both SQLite's datetime('now') and SortExecutor write zone-less UTC
 * ("YYYY-MM-DD HH:MM:SS"). `new Date()` would read that as local time and
 * shift every timestamp by the machine's UTC offset.
 */
function sqliteUtcToDate(value: string): Date {
  const isZoneless = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
  return new Date(isZoneless ? `${value.replace(' ', 'T')}Z` : value)
}
