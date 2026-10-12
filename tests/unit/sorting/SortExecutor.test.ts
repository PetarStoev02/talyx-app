import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, writeFile, readFile, access, rm, mkdir, symlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import Database from 'better-sqlite3'
import { runMigrations } from '../../../src/main/infrastructure/database/migrations'
import { SortHistoryRepo } from '../../../src/main/domain/sorting/repository/SortHistoryRepo'
import { SortExecutor } from '../../../src/main/domain/sorting/services/SortExecutor'
import type { ClassifiedFile } from '../../../src/main/domain/sorting/services/SortExecutor'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

function makeClassifiedFile(
  dir: string,
  name: string,
  overrides: Partial<ClassifiedFile['classification']> = {}
): ClassifiedFile {
  return {
    path: join(dir, name),
    name,
    size: 1024,
    classification: {
      category: 'Documents',
      subcategory: 'Reports',
      confidence: 0.95,
      metadata: {},
      ...overrides
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

describe('SortExecutor', () => {
  let db: Database.Database
  let repo: SortHistoryRepo
  let executor: SortExecutor
  let sourceDir: string
  let outputDir: string

  beforeEach(async () => {
    db = createTestDb()
    repo = new SortHistoryRepo(db)
    executor = new SortExecutor(repo)
    sourceDir = await mkdtemp(join(tmpdir(), 'sort-src-'))
    outputDir = await mkdtemp(join(tmpdir(), 'sort-out-'))
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    db.close()
    await rm(sourceDir, { recursive: true, force: true })
    await rm(outputDir, { recursive: true, force: true })
  })

  it('should copy files to categorized destination', async () => {
    await writeFile(join(sourceDir, 'report.pdf'), 'pdf content')
    const files = [makeClassifiedFile(sourceDir, 'report.pdf')]

    const batch = await executor.executeBatch(files, outputDir, 'copy')

    // Source still exists (copy mode)
    expect(await fileExists(join(sourceDir, 'report.pdf'))).toBe(true)
    // Dest exists in category/subcategory
    expect(await fileExists(join(outputDir, 'Documents', 'Reports', 'report.pdf'))).toBe(true)
    expect(batch.operations).toHaveLength(1)
    expect(batch.totalFiles).toBe(1)
  })

  it('should move files to categorized destination', async () => {
    await writeFile(join(sourceDir, 'report.pdf'), 'pdf content')
    const files = [makeClassifiedFile(sourceDir, 'report.pdf')]

    const batch = await executor.executeBatch(files, outputDir, 'move')

    // Source no longer exists (move mode)
    expect(await fileExists(join(sourceDir, 'report.pdf'))).toBe(false)
    // Dest exists
    expect(await fileExists(join(outputDir, 'Documents', 'Reports', 'report.pdf'))).toBe(true)
    expect(batch.operations).toHaveLength(1)
  })

  it('should handle duplicate filenames with _1, _2 suffixes', async () => {
    await writeFile(join(sourceDir, 'a.pdf'), 'first')
    await writeFile(join(sourceDir, 'b.pdf'), 'second')

    const file1: ClassifiedFile = { ...makeClassifiedFile(sourceDir, 'a.pdf'), name: 'report.pdf' }
    const file2: ClassifiedFile = { ...makeClassifiedFile(sourceDir, 'b.pdf'), name: 'report.pdf' }

    await executor.executeBatch([file1], outputDir, 'copy')
    const batch2 = await executor.executeBatch([file2], outputDir, 'copy')

    expect(await fileExists(join(outputDir, 'Documents', 'Reports', 'report.pdf'))).toBe(true)
    expect(await fileExists(join(outputDir, 'Documents', 'Reports', 'report_1.pdf'))).toBe(true)
    expect(batch2.operations[0].destPath).toContain('report_1.pdf')
  })

  it('should record operations in the history repo', async () => {
    await writeFile(join(sourceDir, 'doc.pdf'), 'content')
    const files = [makeClassifiedFile(sourceDir, 'doc.pdf')]

    const batch = await executor.executeBatch(files, outputDir, 'copy')

    const ops = repo.getBatchOperations(batch.batchId)
    expect(ops).toHaveLength(1)
    expect(ops[0].operationType).toBe('copy')
    expect(ops[0].category).toBe('Documents')
    expect(ops[0].subcategory).toBe('Reports')
    expect(ops[0].fileName).toBe('doc.pdf')
  })

  it('should group all operations under the same batch ID', async () => {
    await writeFile(join(sourceDir, 'a.pdf'), 'a')
    await writeFile(join(sourceDir, 'b.pdf'), 'b')
    const files = [makeClassifiedFile(sourceDir, 'a.pdf'), makeClassifiedFile(sourceDir, 'b.pdf')]

    const batch = await executor.executeBatch(files, outputDir, 'copy')

    const ops = repo.getBatchOperations(batch.batchId)
    expect(ops).toHaveLength(2)
    expect(ops.every((op) => op.batchId === batch.batchId)).toBe(true)
  })

  it('should place files without subcategory in category root', async () => {
    await writeFile(join(sourceDir, 'file.xyz'), 'data')
    const files = [
      makeClassifiedFile(sourceDir, 'file.xyz', { category: 'Other', subcategory: null })
    ]

    await executor.executeBatch(files, outputDir, 'copy')

    expect(await fileExists(join(outputDir, 'Other', 'file.xyz'))).toBe(true)
  })

  it('should call onProgress callback during batch execution', async () => {
    await writeFile(join(sourceDir, 'a.pdf'), 'a')
    await writeFile(join(sourceDir, 'b.pdf'), 'b')
    const files = [makeClassifiedFile(sourceDir, 'a.pdf'), makeClassifiedFile(sourceDir, 'b.pdf')]

    const progressCalls: { current: number; total: number; fileName: string }[] = []

    await executor.executeBatch(files, outputDir, 'copy', (p) => progressCalls.push(p))

    expect(progressCalls).toEqual([
      { current: 1, total: 2, fileName: 'a.pdf' },
      { current: 2, total: 2, fileName: 'b.pdf' }
    ])
  })

  it('should preserve file content when copying', async () => {
    const content = 'important document content'
    await writeFile(join(sourceDir, 'doc.txt'), content)
    const files = [
      makeClassifiedFile(sourceDir, 'doc.txt', { category: 'Documents', subcategory: null })
    ]

    await executor.executeBatch(files, outputDir, 'copy')

    const copied = await readFile(join(outputDir, 'Documents', 'doc.txt'), 'utf-8')
    expect(copied).toBe(content)
  })

  describe('symlinks', () => {
    it.each(['copy', 'move'] as const)(
      'should skip a symlink to a file outside the source in %s mode and sort the rest',
      async (mode) => {
        const elsewhere = await mkdtemp(join(tmpdir(), 'sort-secret-'))
        const secret = join(elsewhere, 'credentials')
        await writeFile(secret, 'aws-secret')
        await symlink(secret, join(sourceDir, 'notes.txt'))
        await writeFile(join(sourceDir, 'report.pdf'), 'pdf')
        const files = [
          makeClassifiedFile(sourceDir, 'notes.txt'),
          makeClassifiedFile(sourceDir, 'report.pdf')
        ]

        const batch = await executor.executeBatch(files, outputDir, mode)

        expect(await fileExists(join(outputDir, 'Documents', 'Reports', 'notes.txt'))).toBe(false)
        expect(await readFile(secret, 'utf-8')).toBe('aws-secret')
        expect(await fileExists(join(outputDir, 'Documents', 'Reports', 'report.pdf'))).toBe(true)
        expect(batch.operations.map((op) => op.fileName)).toEqual(['report.pdf'])
        await rm(elsewhere, { recursive: true, force: true })
      }
    )
  })

  describe('path traversal protection', () => {
    it('should refuse to write through a symlinked folder that leads outside the output', async () => {
      const elsewhere = await mkdtemp(join(tmpdir(), 'sort-elsewhere-'))
      await symlink(elsewhere, join(outputDir, 'Documents'))
      await writeFile(join(sourceDir, 'report.pdf'), 'pdf')
      const files = [makeClassifiedFile(sourceDir, 'report.pdf')]

      await expect(executor.executeBatch(files, outputDir, 'move')).rejects.toThrow(
        'Path traversal blocked'
      )
      expect(await fileExists(join(sourceDir, 'report.pdf'))).toBe(true)
      await rm(elsewhere, { recursive: true, force: true })
    })

    it('should reject paths that escape output directory via ../', async () => {
      await writeFile(join(sourceDir, 'evil.pdf'), 'data')
      const files = [
        makeClassifiedFile(sourceDir, 'evil.pdf', {
          category: '..',
          subcategory: '..'
        })
      ]

      await expect(executor.executeBatch(files, outputDir, 'copy')).rejects.toThrow(
        'Path traversal blocked'
      )
    })

    it('should reject semantic paths that escape output directory', async () => {
      await writeFile(join(sourceDir, 'evil.pdf'), 'data')
      const files: ClassifiedFile[] = [
        {
          path: join(sourceDir, 'evil.pdf'),
          name: 'evil.pdf',
          size: 1024,
          classification: {
            category: 'Documents',
            subcategory: null,
            confidence: 0.9,
            metadata: {},
            semanticPath: ['..', '..', '..', 'etc']
          }
        }
      ]

      await expect(executor.executeBatch(files, outputDir, 'copy')).rejects.toThrow(
        'Path traversal blocked'
      )
    })

    it('should hand the files it just sorted to the search index', async () => {
      await writeFile(join(sourceDir, 'notes.md'), 'data')
      const scan = vi.fn().mockResolvedValue({ indexed: 1, total: 1 })
      const indexing = new SortExecutor(repo, { scan } as never)

      await indexing.executeBatch([makeClassifiedFile(sourceDir, 'notes.md')], outputDir, 'copy')

      expect(scan).toHaveBeenCalledWith([
        { path: join(outputDir, 'Documents', 'Reports', 'notes.md'), name: 'notes.md' }
      ])
    })

    it('should keep the original extension when the model buries it mid-name', async () => {
      await writeFile(join(sourceDir, 'notes.md'), 'data')
      const files = [makeClassifiedFile(sourceDir, 'notes.md')]

      const batch = await executor.executeBatch(files, outputDir, 'copy', undefined, {
        [join(sourceDir, 'notes.md')]: 'notes.md_20240101'
      })

      expect(batch.operations[0].fileName).toBe('notes_20240101.md')
      expect(await fileExists(join(outputDir, 'Documents', 'Reports', 'notes_20240101.md'))).toBe(
        true
      )
    })

    it('should append the original extension when the model drops it', async () => {
      await writeFile(join(sourceDir, 'scan001.pdf'), 'data')
      const files = [makeClassifiedFile(sourceDir, 'scan001.pdf')]

      const batch = await executor.executeBatch(files, outputDir, 'copy', undefined, {
        [join(sourceDir, 'scan001.pdf')]: 'acme-invoice-2024'
      })

      expect(batch.operations[0].fileName).toBe('acme-invoice-2024.pdf')
    })

    it('should leave a rename to another real extension alone', async () => {
      await writeFile(join(sourceDir, 'notes.txt'), 'data')
      const files = [makeClassifiedFile(sourceDir, 'notes.txt')]

      const batch = await executor.executeBatch(files, outputDir, 'copy', undefined, {
        [join(sourceDir, 'notes.txt')]: 'meeting-notes.md'
      })

      expect(batch.operations[0].fileName).toBe('meeting-notes.md')
    })

    it('should leave a compound extension alone', async () => {
      await writeFile(join(sourceDir, 'backup.tar.gz'), 'data')
      const files = [makeClassifiedFile(sourceDir, 'backup.tar.gz')]

      const batch = await executor.executeBatch(files, outputDir, 'copy', undefined, {
        [join(sourceDir, 'backup.tar.gz')]: 'site-backup-2024.tar.gz'
      })

      expect(batch.operations[0].fileName).toBe('site-backup-2024.tar.gz')
    })

    it('should index a file under the name it was actually written as', async () => {
      await writeFile(join(sourceDir, 'report.pdf'), 'data')
      const scan = vi.fn().mockResolvedValue({ indexed: 1, total: 1 })
      const indexing = new SortExecutor(repo, { scan } as never)
      const destDir = join(outputDir, 'Documents', 'Reports')
      await mkdir(destDir, { recursive: true })
      await writeFile(join(destDir, 'report.pdf'), 'taken')

      await indexing.executeBatch([makeClassifiedFile(sourceDir, 'report.pdf')], outputDir, 'copy')

      expect(scan).toHaveBeenCalledWith([
        { path: join(destDir, 'report_1.pdf'), name: 'report_1.pdf' }
      ])
    })

    it('should leave a correctly extensioned rename untouched', async () => {
      await writeFile(join(sourceDir, 'IMG_4821.JPG'), 'data')
      const files = [makeClassifiedFile(sourceDir, 'IMG_4821.JPG')]

      const batch = await executor.executeBatch(files, outputDir, 'copy', undefined, {
        [join(sourceDir, 'IMG_4821.JPG')]: 'lisbon-rooftop-2024.jpg'
      })

      expect(batch.operations[0].fileName).toBe('lisbon-rooftop-2024.jpg')
    })

    it('should reject approvedRenames with path traversal', async () => {
      await writeFile(join(sourceDir, 'doc.pdf'), 'data')
      const files = [makeClassifiedFile(sourceDir, 'doc.pdf')]

      await expect(
        executor.executeBatch(files, outputDir, 'copy', undefined, {
          [join(sourceDir, 'doc.pdf')]: '../../../../etc/passwd'
        })
      ).rejects.toThrow('Path traversal blocked')
    })
  })

  describe('after a move', () => {
    it('should keep the folder being sorted even when the sort empties it', async () => {
      await writeFile(join(sourceDir, 'a.pdf'), 'a')

      await executor.executeBatch([makeClassifiedFile(sourceDir, 'a.pdf')], outputDir, 'move')

      expect(await fileExists(sourceDir)).toBe(true)
    })

    it('should remove a subfolder the sort emptied', async () => {
      await mkdir(join(sourceDir, 'sub'))
      await writeFile(join(sourceDir, 'a.pdf'), 'a')
      await writeFile(join(sourceDir, 'sub', 'b.pdf'), 'b')
      await writeFile(join(sourceDir, 'sub', '.DS_Store'), '')

      await executor.executeBatch(
        [
          makeClassifiedFile(sourceDir, 'a.pdf'),
          makeClassifiedFile(join(sourceDir, 'sub'), 'b.pdf')
        ],
        outputDir,
        'move'
      )

      expect(await fileExists(join(sourceDir, 'sub'))).toBe(false)
      expect(await fileExists(sourceDir)).toBe(true)
    })

    it('should keep a subfolder that still holds a file the sort did not take', async () => {
      await mkdir(join(sourceDir, 'sub'))
      await writeFile(join(sourceDir, 'a.pdf'), 'a')
      await writeFile(join(sourceDir, 'sub', 'b.pdf'), 'b')
      await writeFile(join(sourceDir, 'sub', 'keep.txt'), 'k')

      await executor.executeBatch(
        [
          makeClassifiedFile(sourceDir, 'a.pdf'),
          makeClassifiedFile(join(sourceDir, 'sub'), 'b.pdf')
        ],
        outputDir,
        'move'
      )

      expect(await fileExists(join(sourceDir, 'sub', 'keep.txt'))).toBe(true)
    })

    it('should keep both folders when a batch takes the last file from two unrelated folders', async () => {
      const otherDir = await mkdtemp(join(tmpdir(), 'sort-src2-'))
      try {
        await writeFile(join(sourceDir, 'a.pdf'), 'a')
        await writeFile(join(otherDir, 'b.pdf'), 'b')

        await executor.executeBatch(
          [makeClassifiedFile(sourceDir, 'a.pdf'), makeClassifiedFile(otherDir, 'b.pdf')],
          outputDir,
          'move'
        )

        expect(await fileExists(sourceDir)).toBe(true)
        expect(await fileExists(otherDir)).toBe(true)
      } finally {
        await rm(otherDir, { recursive: true, force: true })
      }
    })

    it('should remove an emptied chain of subfolders but stop at the folder being sorted', async () => {
      await mkdir(join(sourceDir, 'x', 'y'), { recursive: true })
      await writeFile(join(sourceDir, 'a.pdf'), 'a')
      await writeFile(join(sourceDir, 'x', 'y', 'b.pdf'), 'b')

      await executor.executeBatch(
        [
          makeClassifiedFile(sourceDir, 'a.pdf'),
          makeClassifiedFile(join(sourceDir, 'x', 'y'), 'b.pdf')
        ],
        outputDir,
        'move'
      )

      expect(await fileExists(join(sourceDir, 'x'))).toBe(false)
      expect(await fileExists(sourceDir)).toBe(true)
    })

    it('should leave empty folders that were already in the output', async () => {
      await mkdir(join(outputDir, 'MyEmptyProject'))
      await writeFile(join(sourceDir, 'a.pdf'), 'a')

      await executor.executeBatch([makeClassifiedFile(sourceDir, 'a.pdf')], outputDir, 'move')

      expect(await fileExists(join(outputDir, 'MyEmptyProject'))).toBe(true)
    })
  })

  it('should stamp the batch with the moment it ran, whatever the time zone', async () => {
    vi.stubEnv('TZ', 'America/New_York')
    await writeFile(join(sourceDir, 'a.pdf'), 'a')
    const before = Date.now()

    const batch = await executor.executeBatch(
      [makeClassifiedFile(sourceDir, 'a.pdf')],
      outputDir,
      'copy'
    )

    expect(Math.abs(batch.timestamp.getTime() - before)).toBeLessThan(5_000)
  })
})
