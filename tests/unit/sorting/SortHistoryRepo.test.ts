import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../../src/main/infrastructure/database/migrations'
import { SortHistoryRepo } from '../../../src/main/domain/sorting/repository/SortHistoryRepo'
import type { SortOperation } from '../../../src/main/domain/sorting/model/SortOperation'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

function makeSortOperation(overrides: Partial<SortOperation> = {}): SortOperation {
  return {
    batchId: 'batch-001',
    sourcePath: '/home/user/downloads/report.pdf',
    destPath: '/home/user/documents/reports/report.pdf',
    operationType: 'copy',
    category: 'Documents',
    subcategory: 'Reports',
    fileName: 'report.pdf',
    fileSize: 1024,
    createdAt: '2025-01-15 10:30:00',
    ...overrides
  }
}

describe('SortHistoryRepo', () => {
  let db: Database.Database
  let repo: SortHistoryRepo

  beforeEach(() => {
    db = createTestDb()
    repo = new SortHistoryRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('timestamps', () => {
    it('should read SQLite zone-less timestamps as UTC', () => {
      repo.recordOperation(makeSortOperation({ createdAt: '2025-01-15 10:30:00' }))

      const [batch] = repo.getHistory(10, 0)

      expect(batch.timestamp.toISOString()).toBe('2025-01-15T10:30:00.000Z')
    })

    it('should return undoneAt as an unambiguous ISO instant', () => {
      repo.recordOperation(makeSortOperation())
      repo.markUndone('batch-001')

      const [batch] = repo.getHistory(10, 0)

      expect(batch.undoneAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/)
      expect(Math.abs(Date.now() - new Date(batch.undoneAt!).getTime())).toBeLessThan(5_000)
    })
  })

  describe('recordOperation', () => {
    it('should insert a sort operation into the database', () => {
      const op = makeSortOperation()

      repo.recordOperation(op)

      const rows = db.prepare('SELECT * FROM sort_operations').all() as Array<
        Record<string, unknown>
      >
      expect(rows).toHaveLength(1)
      expect(rows[0].batch_id).toBe('batch-001')
      expect(rows[0].source_path).toBe('/home/user/downloads/report.pdf')
      expect(rows[0].dest_path).toBe('/home/user/documents/reports/report.pdf')
      expect(rows[0].operation_type).toBe('copy')
      expect(rows[0].category).toBe('Documents')
      expect(rows[0].subcategory).toBe('Reports')
      expect(rows[0].file_name).toBe('report.pdf')
      expect(rows[0].file_size).toBe(1024)
    })

    it('should insert multiple operations for the same batch', () => {
      repo.recordOperation(makeSortOperation({ fileName: 'file1.pdf' }))
      repo.recordOperation(makeSortOperation({ fileName: 'file2.pdf' }))
      repo.recordOperation(makeSortOperation({ fileName: 'file3.pdf' }))

      const rows = db.prepare('SELECT * FROM sort_operations').all()
      expect(rows).toHaveLength(3)
    })

    it('should handle null category and subcategory', () => {
      const op = makeSortOperation({ category: null, subcategory: null })

      repo.recordOperation(op)

      const rows = db.prepare('SELECT * FROM sort_operations').all() as Array<
        Record<string, unknown>
      >
      expect(rows).toHaveLength(1)
      expect(rows[0].category).toBeNull()
      expect(rows[0].subcategory).toBeNull()
    })

    it('should handle null fileSize', () => {
      const op = makeSortOperation({ fileSize: null })

      repo.recordOperation(op)

      const rows = db.prepare('SELECT * FROM sort_operations').all() as Array<
        Record<string, unknown>
      >
      expect(rows).toHaveLength(1)
      expect(rows[0].file_size).toBeNull()
    })

    it('should reject invalid operation_type', () => {
      const op = makeSortOperation()
      ;(op as { operationType: string }).operationType = 'invalid'

      expect(() => repo.recordOperation(op)).toThrow()
    })
  })

  describe('getBatchOperations', () => {
    it('should return all operations for a given batch', () => {
      repo.recordOperation(makeSortOperation({ batchId: 'batch-A', fileName: 'a1.pdf' }))
      repo.recordOperation(makeSortOperation({ batchId: 'batch-A', fileName: 'a2.pdf' }))
      repo.recordOperation(makeSortOperation({ batchId: 'batch-B', fileName: 'b1.pdf' }))

      const ops = repo.getBatchOperations('batch-A')

      expect(ops).toHaveLength(2)
      expect(ops[0].fileName).toBe('a1.pdf')
      expect(ops[1].fileName).toBe('a2.pdf')
      expect(ops.every((op) => op.batchId === 'batch-A')).toBe(true)
    })

    it('should return empty array for non-existent batch', () => {
      const ops = repo.getBatchOperations('non-existent')
      expect(ops).toHaveLength(0)
    })

    it('should map database rows to SortOperation domain model', () => {
      repo.recordOperation(makeSortOperation())

      const ops = repo.getBatchOperations('batch-001')

      expect(ops).toHaveLength(1)
      const op = ops[0]
      expect(op.id).toBeDefined()
      expect(typeof op.id).toBe('number')
      expect(op.batchId).toBe('batch-001')
      expect(op.sourcePath).toBe('/home/user/downloads/report.pdf')
      expect(op.destPath).toBe('/home/user/documents/reports/report.pdf')
      expect(op.operationType).toBe('copy')
      expect(op.category).toBe('Documents')
      expect(op.subcategory).toBe('Reports')
      expect(op.fileName).toBe('report.pdf')
      expect(op.fileSize).toBe(1024)
      expect(op.createdAt).toBe('2025-01-15 10:30:00')
    })
  })

  describe('markUndone', () => {
    it('should stamp the batch as undone while keeping its operations', () => {
      repo.recordOperation(makeSortOperation({ batchId: 'batch-1', fileName: 'a.pdf' }))
      repo.recordOperation(makeSortOperation({ batchId: 'batch-2', fileName: 'b.pdf' }))

      repo.markUndone('batch-1')

      const history = repo.getHistory(10, 0)
      const undone = history.find((b) => b.batchId === 'batch-1')
      const active = history.find((b) => b.batchId === 'batch-2')
      expect(undone?.undoneAt).not.toBeNull()
      expect(undone?.operations).toHaveLength(1)
      expect(active?.undoneAt).toBeNull()
    })
  })

  describe('getHistory', () => {
    it('should return batches grouped by batch_id', () => {
      repo.recordOperation(
        makeSortOperation({
          batchId: 'batch-1',
          fileName: 'a.pdf',
          createdAt: '2025-01-15 10:00:00'
        })
      )
      repo.recordOperation(
        makeSortOperation({
          batchId: 'batch-1',
          fileName: 'b.pdf',
          createdAt: '2025-01-15 10:01:00'
        })
      )
      repo.recordOperation(
        makeSortOperation({
          batchId: 'batch-2',
          fileName: 'c.pdf',
          createdAt: '2025-01-15 11:00:00'
        })
      )

      const batches = repo.getHistory(10, 0)

      expect(batches).toHaveLength(2)
    })

    it('should order batches by most recent first', () => {
      repo.recordOperation(
        makeSortOperation({ batchId: 'batch-old', createdAt: '2025-01-10 10:00:00' })
      )
      repo.recordOperation(
        makeSortOperation({ batchId: 'batch-new', createdAt: '2025-01-20 10:00:00' })
      )

      const batches = repo.getHistory(10, 0)

      expect(batches).toHaveLength(2)
      expect(batches[0].batchId).toBe('batch-new')
      expect(batches[1].batchId).toBe('batch-old')
    })

    it('should populate batch with correct totalFiles count', () => {
      repo.recordOperation(
        makeSortOperation({
          batchId: 'batch-1',
          fileName: 'a.pdf',
          createdAt: '2025-01-15 10:00:00'
        })
      )
      repo.recordOperation(
        makeSortOperation({
          batchId: 'batch-1',
          fileName: 'b.pdf',
          createdAt: '2025-01-15 10:01:00'
        })
      )
      repo.recordOperation(
        makeSortOperation({
          batchId: 'batch-1',
          fileName: 'c.pdf',
          createdAt: '2025-01-15 10:02:00'
        })
      )

      const batches = repo.getHistory(10, 0)

      expect(batches).toHaveLength(1)
      expect(batches[0].totalFiles).toBe(3)
      expect(batches[0].operations).toHaveLength(3)
    })

    it('should populate batch timestamp as Date', () => {
      repo.recordOperation(
        makeSortOperation({ batchId: 'batch-1', createdAt: '2025-01-15 10:00:00' })
      )

      const batches = repo.getHistory(10, 0)

      expect(batches[0].timestamp).toBeInstanceOf(Date)
    })

    it('should respect limit parameter', () => {
      repo.recordOperation(
        makeSortOperation({ batchId: 'batch-1', createdAt: '2025-01-15 10:00:00' })
      )
      repo.recordOperation(
        makeSortOperation({ batchId: 'batch-2', createdAt: '2025-01-16 10:00:00' })
      )
      repo.recordOperation(
        makeSortOperation({ batchId: 'batch-3', createdAt: '2025-01-17 10:00:00' })
      )

      const batches = repo.getHistory(2, 0)

      expect(batches).toHaveLength(2)
    })

    it('should respect offset parameter', () => {
      repo.recordOperation(
        makeSortOperation({ batchId: 'batch-1', createdAt: '2025-01-15 10:00:00' })
      )
      repo.recordOperation(
        makeSortOperation({ batchId: 'batch-2', createdAt: '2025-01-16 10:00:00' })
      )
      repo.recordOperation(
        makeSortOperation({ batchId: 'batch-3', createdAt: '2025-01-17 10:00:00' })
      )

      const batches = repo.getHistory(10, 1)

      expect(batches).toHaveLength(2)
      // Most recent first, skip 1 means we skip batch-3
      expect(batches[0].batchId).toBe('batch-2')
      expect(batches[1].batchId).toBe('batch-1')
    })

    it('should return empty array when no operations exist', () => {
      const batches = repo.getHistory(10, 0)
      expect(batches).toHaveLength(0)
    })
  })

  describe('deleteBatch', () => {
    it('should delete all operations for a given batch', () => {
      repo.recordOperation(makeSortOperation({ batchId: 'batch-1', fileName: 'a.pdf' }))
      repo.recordOperation(makeSortOperation({ batchId: 'batch-1', fileName: 'b.pdf' }))
      repo.recordOperation(makeSortOperation({ batchId: 'batch-2', fileName: 'c.pdf' }))

      repo.deleteBatch('batch-1')

      const allRows = db.prepare('SELECT * FROM sort_operations').all()
      expect(allRows).toHaveLength(1)

      const ops = repo.getBatchOperations('batch-1')
      expect(ops).toHaveLength(0)

      const remaining = repo.getBatchOperations('batch-2')
      expect(remaining).toHaveLength(1)
    })

    it('should not throw when deleting a non-existent batch', () => {
      expect(() => repo.deleteBatch('non-existent')).not.toThrow()
    })
  })
})
