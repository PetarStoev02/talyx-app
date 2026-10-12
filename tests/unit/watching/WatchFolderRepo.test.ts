import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../../src/main/infrastructure/database/migrations'
import { WatchFolderRepo } from '../../../src/main/domain/watching/repository/WatchFolderRepo'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

describe('WatchFolderRepo', () => {
  let db: Database.Database
  let repo: WatchFolderRepo

  beforeEach(() => {
    db = createTestDb()
    repo = new WatchFolderRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('add', () => {
    it('should insert a watch folder and return it with id', () => {
      const folder = repo.add({
        path: '/home/user/downloads',
        enabled: true,
        outputPath: '/home/user/sorted',
        sortMode: 'copy'
      })

      expect(folder.id).toBeDefined()
      expect(folder.path).toBe('/home/user/downloads')
      expect(folder.enabled).toBe(true)
      expect(folder.outputPath).toBe('/home/user/sorted')
      expect(folder.sortMode).toBe('copy')
      expect(folder.createdAt).toBeDefined()
    })

    it('should reject duplicate paths', () => {
      repo.add({ path: '/home/user/downloads', enabled: true, outputPath: null, sortMode: 'copy' })

      expect(() =>
        repo.add({
          path: '/home/user/downloads',
          enabled: true,
          outputPath: null,
          sortMode: 'copy'
        })
      ).toThrow()
    })
  })

  describe('getAll', () => {
    it('should return all watch folders', () => {
      repo.add({ path: '/path/a', enabled: true, outputPath: null, sortMode: 'copy' })
      repo.add({ path: '/path/b', enabled: false, outputPath: null, sortMode: 'move' })

      const folders = repo.getAll()

      expect(folders).toHaveLength(2)
    })

    it('should return empty array when no folders exist', () => {
      expect(repo.getAll()).toHaveLength(0)
    })
  })

  describe('getEnabled', () => {
    it('should return only enabled folders', () => {
      repo.add({ path: '/path/a', enabled: true, outputPath: null, sortMode: 'copy' })
      repo.add({ path: '/path/b', enabled: false, outputPath: null, sortMode: 'copy' })
      repo.add({ path: '/path/c', enabled: true, outputPath: null, sortMode: 'copy' })

      const enabled = repo.getEnabled()

      expect(enabled).toHaveLength(2)
      expect(enabled.every((f) => f.enabled)).toBe(true)
    })
  })

  describe('setEnabled', () => {
    it('should toggle enabled state', () => {
      const folder = repo.add({
        path: '/path/a',
        enabled: true,
        outputPath: null,
        sortMode: 'copy'
      })

      repo.setEnabled(folder.id!, false)

      const updated = repo.getById(folder.id!)
      expect(updated?.enabled).toBe(false)
    })
  })

  describe('remove', () => {
    it('should delete a watch folder', () => {
      const folder = repo.add({
        path: '/path/a',
        enabled: true,
        outputPath: null,
        sortMode: 'copy'
      })

      repo.remove(folder.id!)

      expect(repo.getById(folder.id!)).toBeNull()
      expect(repo.getAll()).toHaveLength(0)
    })

    it('should not throw when removing non-existent folder', () => {
      expect(() => repo.remove(999)).not.toThrow()
    })
  })

  describe('getById', () => {
    it('should return null for non-existent id', () => {
      expect(repo.getById(999)).toBeNull()
    })

    it('should return the folder by id', () => {
      const added = repo.add({
        path: '/path/a',
        enabled: true,
        outputPath: '/out',
        sortMode: 'move'
      })

      const folder = repo.getById(added.id!)

      expect(folder).not.toBeNull()
      expect(folder!.path).toBe('/path/a')
      expect(folder!.sortMode).toBe('move')
    })
  })
})
