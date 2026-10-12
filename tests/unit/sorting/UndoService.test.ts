import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, readFile, access, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import Database from 'better-sqlite3'
import { runMigrations } from '../../../src/main/infrastructure/database/migrations'
import { SortHistoryRepo } from '../../../src/main/domain/sorting/repository/SortHistoryRepo'
import { SortExecutor } from '../../../src/main/domain/sorting/services/SortExecutor'
import { UndoService } from '../../../src/main/domain/sorting/services/UndoService'
import type { ClassifiedFile } from '../../../src/main/domain/sorting/services/SortExecutor'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

function makeClassifiedFile(dir: string, name: string): ClassifiedFile {
  return {
    path: join(dir, name),
    name,
    size: 1024,
    classification: {
      category: 'Documents',
      subcategory: 'Reports',
      confidence: 0.95,
      metadata: {}
    }
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('UndoService', () => {
  let db: Database.Database
  let repo: SortHistoryRepo
  let executor: SortExecutor
  let undoService: UndoService
  let sourceDir: string
  let outputDir: string

  beforeEach(async () => {
    db = createTestDb()
    repo = new SortHistoryRepo(db)
    executor = new SortExecutor(repo)
    undoService = new UndoService(repo)
    sourceDir = await mkdtemp(join(tmpdir(), 'undo-src-'))
    outputDir = await mkdtemp(join(tmpdir(), 'undo-out-'))
  })

  afterEach(async () => {
    db.close()
    await rm(sourceDir, { recursive: true, force: true })
    await rm(outputDir, { recursive: true, force: true })
  })

  it('should undo a copy operation by deleting the copied file', async () => {
    await writeFile(join(sourceDir, 'report.pdf'), 'content')
    const files = [makeClassifiedFile(sourceDir, 'report.pdf')]

    const batch = await executor.executeBatch(files, outputDir, 'copy')
    const destPath = batch.operations[0].destPath

    // File was copied
    expect(await fileExists(destPath)).toBe(true)

    const result = await undoService.undoBatch(batch.batchId)

    // Copy was deleted
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.reversed).toBe(1)
    expect(await fileExists(destPath)).toBe(false)
    // Original still exists
    expect(await fileExists(join(sourceDir, 'report.pdf'))).toBe(true)
  })

  it('should undo a move operation by moving the file back', async () => {
    await writeFile(join(sourceDir, 'report.pdf'), 'content')
    const files = [makeClassifiedFile(sourceDir, 'report.pdf')]

    const batch = await executor.executeBatch(files, outputDir, 'move')
    const destPath = batch.operations[0].destPath

    // File was moved away
    expect(await fileExists(join(sourceDir, 'report.pdf'))).toBe(false)
    expect(await fileExists(destPath)).toBe(true)

    const result = await undoService.undoBatch(batch.batchId)

    // File is back in source
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.reversed).toBe(1)
    expect(await fileExists(join(sourceDir, 'report.pdf'))).toBe(true)
    expect(await fileExists(destPath)).toBe(false)
  })

  it('should undo all operations in a batch', async () => {
    await writeFile(join(sourceDir, 'a.pdf'), 'a')
    await writeFile(join(sourceDir, 'b.pdf'), 'b')
    const files = [makeClassifiedFile(sourceDir, 'a.pdf'), makeClassifiedFile(sourceDir, 'b.pdf')]

    const batch = await executor.executeBatch(files, outputDir, 'copy')

    const result = await undoService.undoBatch(batch.batchId)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.reversed).toBe(2)

    // Both copies deleted
    for (const op of batch.operations) {
      expect(await fileExists(op.destPath)).toBe(false)
    }
  })

  it('should keep the batch in history marked as undone after undo', async () => {
    await writeFile(join(sourceDir, 'a.pdf'), 'a')
    const files = [makeClassifiedFile(sourceDir, 'a.pdf')]

    const batch = await executor.executeBatch(files, outputDir, 'copy')

    await undoService.undoBatch(batch.batchId)

    const history = repo.getHistory(10, 0)
    expect(history).toHaveLength(1)
    expect(history[0].batchId).toBe(batch.batchId)
    expect(history[0].undoneAt).not.toBeNull()
  })

  it('should refuse to undo an already-undone batch', async () => {
    await writeFile(join(sourceDir, 'a.pdf'), 'a')
    const files = [makeClassifiedFile(sourceDir, 'a.pdf')]

    const batch = await executor.executeBatch(files, outputDir, 'copy')
    await undoService.undoBatch(batch.batchId)

    const second = await undoService.undoBatch(batch.batchId)
    expect(second.ok).toBe(false)
  })

  it('should handle gracefully when file was already deleted', async () => {
    await writeFile(join(sourceDir, 'a.pdf'), 'a')
    const files = [makeClassifiedFile(sourceDir, 'a.pdf')]

    const batch = await executor.executeBatch(files, outputDir, 'copy')

    // Manually delete the copied file before undo
    await rm(batch.operations[0].destPath)

    const result = await undoService.undoBatch(batch.batchId)

    // Should still succeed (0 actually reversed, one reported)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.reversed).toBe(0)
      expect(result.value.failed).toHaveLength(1)
    }
  })

  it('should keep a new file at the original location instead of moving the old one over it', async () => {
    await writeFile(join(sourceDir, 'a.pdf'), 'old')
    const batch = await executor.executeBatch(
      [makeClassifiedFile(sourceDir, 'a.pdf')],
      outputDir,
      'move'
    )
    await writeFile(join(sourceDir, 'a.pdf'), 'new')

    const result = await undoService.undoBatch(batch.batchId)

    expect(await readFile(join(sourceDir, 'a.pdf'), 'utf-8')).toBe('new')
    expect(await readFile(batch.operations[0].destPath, 'utf-8')).toBe('old')
    expect(result.ok && result.value.failed).toHaveLength(1)
  })

  it('should keep a copy that was edited after the sort', async () => {
    await writeFile(join(sourceDir, 'a.pdf'), 'a')
    const batch = await executor.executeBatch(
      [makeClassifiedFile(sourceDir, 'a.pdf')],
      outputDir,
      'copy'
    )
    await writeFile(batch.operations[0].destPath, 'edited and longer')

    const result = await undoService.undoBatch(batch.batchId)

    expect(await readFile(batch.operations[0].destPath, 'utf-8')).toBe('edited and longer')
    expect(result.ok && result.value.failed).toHaveLength(1)
  })

  it('should keep a copy when the original is gone', async () => {
    await writeFile(join(sourceDir, 'a.pdf'), 'a')
    const batch = await executor.executeBatch(
      [makeClassifiedFile(sourceDir, 'a.pdf')],
      outputDir,
      'copy'
    )
    await rm(join(sourceDir, 'a.pdf'))

    const result = await undoService.undoBatch(batch.batchId)

    expect(await readFile(batch.operations[0].destPath, 'utf-8')).toBe('a')
    expect(result.ok && result.value.failed).toHaveLength(1)
  })

  it('should return error for non-existent batch', async () => {
    const result = await undoService.undoBatch('non-existent-batch')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('No operations found')
  })
})
