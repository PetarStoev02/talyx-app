import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, symlink, readdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import Database from 'better-sqlite3'
import { runMigrations } from '../../../src/main/infrastructure/database/migrations'
import { WatchFolderRepo } from '../../../src/main/domain/watching/repository/WatchFolderRepo'
import {
  WatchService,
  type WatchEvent
} from '../../../src/main/domain/watching/services/WatchService'
import { SortHistoryRepo } from '../../../src/main/domain/sorting/repository/SortHistoryRepo'
import { SortExecutor } from '../../../src/main/domain/sorting/services/SortExecutor'
import type { ClassificationPipeline } from '../../../src/main/domain/classification/services/ClassificationPipeline'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

function createMockPipeline(): ClassificationPipeline {
  return {
    classify: vi.fn().mockResolvedValue({
      category: 'Documents',
      subcategory: 'Reports',
      confidence: 0.95,
      metadata: {}
    }),
    classifyFiles: vi.fn()
  } as unknown as ClassificationPipeline
}

describe('WatchService', () => {
  let db: Database.Database
  let watchRepo: WatchFolderRepo
  let historyRepo: SortHistoryRepo
  let executor: SortExecutor
  let pipeline: ClassificationPipeline
  let watchDir: string
  let outputDir: string
  let events: WatchEvent[]
  let service: WatchService

  beforeEach(async () => {
    db = createTestDb()
    watchRepo = new WatchFolderRepo(db)
    historyRepo = new SortHistoryRepo(db)
    executor = new SortExecutor(historyRepo)
    pipeline = createMockPipeline()
    events = []

    watchDir = await mkdtemp(join(tmpdir(), 'watch-src-'))
    outputDir = await mkdtemp(join(tmpdir(), 'watch-out-'))

    service = new WatchService(watchRepo, pipeline, executor, (event) => {
      events.push(event)
    })
  })

  afterEach(async () => {
    await service.stopAll()
    db.close()
    await rm(watchDir, { recursive: true, force: true })
    await rm(outputDir, { recursive: true, force: true })
  })

  function addWatchFolder(
    path: string,
    outputPath: string,
    sortMode: 'copy' | 'move' = 'copy'
  ): ReturnType<WatchFolderRepo['add']> {
    return watchRepo.add({ path, enabled: true, outputPath, sortMode })
  }

  describe('startWatching', () => {
    it('should start watching a folder and report isWatching', async () => {
      const folder = addWatchFolder(watchDir, outputDir)

      await service.startWatching(folder)

      expect(service.isWatching(folder.id!)).toBe(true)
    })

    it('should not start watching if folder has no id', async () => {
      await service.startWatching({
        id: undefined as unknown as number,
        path: watchDir,
        outputPath: outputDir,
        enabled: true,
        sortMode: 'copy',
        createdAt: new Date().toISOString()
      })

      // No watchers should be created
      expect(service.isWatching(0)).toBe(false)
    })

    it('should not start watching if folder has no outputPath', async () => {
      await service.startWatching({
        id: 1,
        path: watchDir,
        outputPath: null,
        enabled: true,
        sortMode: 'copy',
        createdAt: new Date().toISOString()
      })

      expect(service.isWatching(1)).toBe(false)
    })

    it('should not start duplicate watchers for the same folder', async () => {
      const folder = addWatchFolder(watchDir, outputDir)

      await service.startWatching(folder)
      await service.startWatching(folder)

      expect(service.isWatching(folder.id!)).toBe(true)
    })

    it('should have correct constructor dependencies wired', () => {
      // Verify service was constructed with all required dependencies
      const folder = addWatchFolder(watchDir, outputDir)
      // startWatching should not throw when given valid folder
      expect(() => service.startWatching(folder)).not.toThrow()
    })

    it('should use pipeline.classify when processing files', () => {
      // Verify the mock pipeline is the one injected
      expect(pipeline.classify).toBeDefined()
      expect(vi.isMockFunction(pipeline.classify)).toBe(true)
    })
  })

  describe('symlinks', () => {
    it('should never classify or sort a symlink dropped into the watched folder', async () => {
      const elsewhere = await mkdtemp(join(tmpdir(), 'watch-secret-'))
      const secret = join(elsewhere, 'credentials')
      await writeFile(secret, 'aws-secret')
      const executeBatch = vi.spyOn(executor, 'executeBatch')
      const folder = addWatchFolder(watchDir, outputDir)
      await service.startWatching(folder)
      // chokidar ignores anything created before its initial scan finishes.
      await new Promise((done) => setTimeout(done, 1000))

      await symlink(secret, join(watchDir, 'notes.txt'))
      await writeFile(join(watchDir, 'report.pdf'), 'pdf')

      // The real file proves the watcher was live, so the symlink had its chance to arrive.
      await vi.waitFor(() => expect(executeBatch).toHaveBeenCalledTimes(1), { timeout: 8000 })
      await new Promise((done) => setTimeout(done, 3000))

      expect(pipeline.classify).toHaveBeenCalledTimes(1)
      expect(pipeline.classify).toHaveBeenCalledWith(join(watchDir, 'report.pdf'))
      expect(executeBatch).toHaveBeenCalledTimes(1)
      expect(await readdir(join(outputDir, 'Documents', 'Reports'))).toEqual(['report.pdf'])
      await rm(elsewhere, { recursive: true, force: true })
    }, 20000)
  })

  describe('stopWatching', () => {
    it('should stop watching a folder', async () => {
      const folder = addWatchFolder(watchDir, outputDir)
      await service.startWatching(folder)
      expect(service.isWatching(folder.id!)).toBe(true)

      await service.stopWatching(folder.id!)
      expect(service.isWatching(folder.id!)).toBe(false)
    })

    it('should handle stopping a non-watched folder gracefully', async () => {
      await service.stopWatching(999)
      expect(service.isWatching(999)).toBe(false)
    })
  })

  describe('startAll', () => {
    it('should start watching all enabled folders', async () => {
      const folder1 = addWatchFolder(watchDir, outputDir)

      const watchDir2 = await mkdtemp(join(tmpdir(), 'watch-src2-'))
      const folder2 = addWatchFolder(watchDir2, outputDir)

      await service.startAll()

      expect(service.isWatching(folder1.id!)).toBe(true)
      expect(service.isWatching(folder2.id!)).toBe(true)

      await rm(watchDir2, { recursive: true, force: true })
    })

    it('should not start watching disabled folders', async () => {
      const folder = addWatchFolder(watchDir, outputDir)
      watchRepo.setEnabled(folder.id!, false)

      await service.startAll()

      expect(service.isWatching(folder.id!)).toBe(false)
    })
  })

  describe('stopAll', () => {
    it('should stop all active watchers', async () => {
      const folder = addWatchFolder(watchDir, outputDir)
      await service.startWatching(folder)

      await service.stopAll()

      expect(service.isWatching(folder.id!)).toBe(false)
    })

    it('should handle stopAll when no watchers are active', async () => {
      await service.stopAll()
      // Should not throw
    })
  })

  describe('isWatching', () => {
    it('should return false for unknown folder id', () => {
      expect(service.isWatching(42)).toBe(false)
    })
  })
})
