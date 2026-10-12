import type Database from 'better-sqlite3'
import type { SearchStats } from '../model/SearchResult'

interface FtsRow {
  file_path: string
  snippet: string
  rank: number
}

interface EmbeddingRow {
  file_path: string
  embedding: Buffer
}

interface CountRow {
  count: number
}

interface LatestRow {
  latest: number | null
}

export class SearchIndexRepo {
  constructor(private db: Database.Database) {}

  indexContent(filePath: string, content: string, contentSource: string, language: string): void {
    // Upsert: delete existing then insert
    this.db.prepare('DELETE FROM file_content_fts WHERE file_path = ?').run(filePath)
    this.db
      .prepare(
        `INSERT INTO file_content_fts (file_path, content, content_source, language)
         VALUES (?, ?, ?, ?)`
      )
      .run(filePath, content, contentSource, language)
  }

  searchKeyword(
    query: string,
    limit: number = 20
  ): { filePath: string; snippet: string; rank: number }[] {
    // Try FTS5 MATCH first (fast, ranked)
    try {
      // Use OR for multi-word queries + prefix matching with *
      const words = query
        .replace(/['"]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 0)

      // Each word gets prefix matching (cursor* matches cursor, cursors, etc.)
      // Words joined with OR so "cursor image" matches files with either word
      const safeQuery = words.map((w) => `"${w}"*`).join(' OR ')

      if (!safeQuery) return []

      const rows = this.db
        .prepare(
          `SELECT file_path, snippet(file_content_fts, 1, '<b>', '</b>', '...', 32) as snippet, rank
           FROM file_content_fts
           WHERE file_content_fts MATCH ?
           ORDER BY rank
           LIMIT ?`
        )
        .all(safeQuery, limit) as FtsRow[]

      return rows.map((r) => ({
        filePath: r.file_path,
        snippet: r.snippet,
        rank: r.rank
      }))
    } catch {
      // FTS5 MATCH failed — fall back to LIKE search
      return this.searchLike(query, limit)
    }
  }

  private searchLike(
    query: string,
    limit: number
  ): { filePath: string; snippet: string; rank: number }[] {
    const words = query.split(/\s+/).filter((w) => w.length > 0)
    if (words.length === 0) return []

    // Search for any word matching in content
    const conditions = words.map(() => 'content LIKE ?').join(' OR ')
    const params = words.map((w) => `%${w}%`)

    try {
      const rows = this.db
        .prepare(
          `SELECT file_path, substr(content, 1, 200) as snippet
           FROM file_content_fts
           WHERE ${conditions}
           LIMIT ?`
        )
        .all(...params, limit) as Array<{ file_path: string; snippet: string }>

      return rows.map((r, i) => ({
        filePath: r.file_path,
        snippet: r.snippet,
        rank: -(i + 1)
      }))
    } catch {
      return []
    }
  }

  storeEmbedding(filePath: string, embedding: Float32Array, modelVersion: string): void {
    const buffer = Buffer.from(embedding.buffer)
    this.db
      .prepare(
        `INSERT OR REPLACE INTO file_embeddings (file_path, embedding, model_version)
         VALUES (?, ?, ?)`
      )
      .run(filePath, buffer, modelVersion)
  }

  getEmbedding(filePath: string): Float32Array | null {
    const row = this.db
      .prepare('SELECT embedding FROM file_embeddings WHERE file_path = ?')
      .get(filePath) as EmbeddingRow | undefined
    if (!row) return null
    return new Float32Array(
      row.embedding.buffer,
      row.embedding.byteOffset,
      row.embedding.byteLength / 4
    )
  }

  getAllEmbeddings(): { filePath: string; embedding: Float32Array }[] {
    const rows = this.db
      .prepare('SELECT file_path, embedding FROM file_embeddings')
      .all() as EmbeddingRow[]

    return rows.map((r) => ({
      filePath: r.file_path,
      embedding: new Float32Array(
        r.embedding.buffer,
        r.embedding.byteOffset,
        r.embedding.byteLength / 4
      )
    }))
  }

  /** Return all indexed file paths (for AI semantic search) */
  getAllFilePaths(limit: number = 500): string[] {
    const rows = this.db
      .prepare('SELECT file_path FROM file_content_fts LIMIT ?')
      .all(limit) as Array<{ file_path: string }>
    return rows.map((r) => r.file_path)
  }

  removeFile(filePath: string): void {
    this.db.prepare('DELETE FROM file_content_fts WHERE file_path = ?').run(filePath)
    this.db.prepare('DELETE FROM file_embeddings WHERE file_path = ?').run(filePath)
  }

  getStats(): SearchStats {
    const ftsCount = this.db
      .prepare('SELECT COUNT(*) as count FROM file_content_fts')
      .get() as CountRow
    const embCount = this.db
      .prepare('SELECT COUNT(*) as count FROM file_embeddings')
      .get() as CountRow
    const latest = this.db
      .prepare('SELECT MAX(created_at) as latest FROM file_embeddings')
      .get() as LatestRow

    return {
      indexedFiles: ftsCount.count,
      totalEmbeddings: embCount.count,
      lastIndexedAt: latest.latest ? new Date(latest.latest * 1000).toISOString() : null
    }
  }
}
