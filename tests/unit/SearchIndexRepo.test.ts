import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { SearchIndexRepo } from '../../src/main/domain/search/repository/SearchIndexRepo'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS file_content_fts USING fts5(
      file_path,
      content,
      content_source,
      language
    );

    CREATE TABLE IF NOT EXISTS file_embeddings (
      file_path TEXT PRIMARY KEY,
      embedding BLOB NOT NULL,
      model_version TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  return db
}

describe('SearchIndexRepo', () => {
  let db: Database.Database
  let repo: SearchIndexRepo

  beforeEach(() => {
    db = createTestDb()
    repo = new SearchIndexRepo(db)
  })

  describe('indexContent and searchKeyword', () => {
    it('should index content and find it via FTS5 search', () => {
      repo.indexContent('/docs/report.pdf', 'quarterly financial report Q3 2025', 'pdf', 'en')
      repo.indexContent('/docs/invoice.pdf', 'invoice for consulting services', 'pdf', 'en')

      const results = repo.searchKeyword('financial report')
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results[0].filePath).toBe('/docs/report.pdf')
      expect(results[0].snippet).toBeTruthy()
    })

    it('should upsert content on re-index', () => {
      repo.indexContent('/docs/file.txt', 'old content', 'text', 'en')
      repo.indexContent('/docs/file.txt', 'new updated content', 'text', 'en')

      // "old" should not appear in the updated content
      const oldResults = repo.searchKeyword('old')
      expect(oldResults.length).toBe(0)

      const newResults = repo.searchKeyword('new updated')
      expect(newResults.length).toBe(1)
      expect(newResults[0].filePath).toBe('/docs/file.txt')
    })
  })

  describe('storeEmbedding and getEmbedding', () => {
    it('should store and retrieve Float32Array embeddings', () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])
      repo.storeEmbedding('/docs/file.txt', embedding, 'v1.0')

      const retrieved = repo.getEmbedding('/docs/file.txt')
      expect(retrieved).not.toBeNull()
      expect(retrieved!.length).toBe(5)
      expect(retrieved![0]).toBeCloseTo(0.1)
      expect(retrieved![4]).toBeCloseTo(0.5)
    })

    it('should return null for non-existent embedding', () => {
      const result = repo.getEmbedding('/nonexistent')
      expect(result).toBeNull()
    })

    it('should overwrite embedding on re-store', () => {
      const first = new Float32Array([1.0, 2.0])
      const second = new Float32Array([3.0, 4.0, 5.0])

      repo.storeEmbedding('/docs/file.txt', first, 'v1.0')
      repo.storeEmbedding('/docs/file.txt', second, 'v2.0')

      const retrieved = repo.getEmbedding('/docs/file.txt')
      expect(retrieved!.length).toBe(3)
      expect(retrieved![0]).toBeCloseTo(3.0)
    })
  })

  describe('getAllEmbeddings', () => {
    it('should return all stored embeddings', () => {
      repo.storeEmbedding('/a.txt', new Float32Array([1.0]), 'v1')
      repo.storeEmbedding('/b.txt', new Float32Array([2.0]), 'v1')

      const all = repo.getAllEmbeddings()
      expect(all.length).toBe(2)
      expect(all.map((e) => e.filePath).sort()).toEqual(['/a.txt', '/b.txt'])
    })
  })

  describe('removeFile', () => {
    it('should delete content and embedding for a file', () => {
      repo.indexContent('/docs/file.txt', 'some content here', 'text', 'en')
      repo.storeEmbedding('/docs/file.txt', new Float32Array([1.0, 2.0]), 'v1')

      repo.removeFile('/docs/file.txt')

      const searchResults = repo.searchKeyword('some content')
      expect(searchResults.length).toBe(0)

      const embedding = repo.getEmbedding('/docs/file.txt')
      expect(embedding).toBeNull()
    })
  })

  describe('getStats', () => {
    it('should return correct counts', () => {
      const emptyStats = repo.getStats()
      expect(emptyStats.indexedFiles).toBe(0)
      expect(emptyStats.totalEmbeddings).toBe(0)
      expect(emptyStats.lastIndexedAt).toBeNull()

      repo.indexContent('/a.txt', 'content a', 'text', 'en')
      repo.indexContent('/b.txt', 'content b', 'text', 'en')
      repo.storeEmbedding('/a.txt', new Float32Array([1.0]), 'v1')

      const stats = repo.getStats()
      expect(stats.indexedFiles).toBe(2)
      expect(stats.totalEmbeddings).toBe(1)
      expect(stats.lastIndexedAt).not.toBeNull()
    })
  })
})
