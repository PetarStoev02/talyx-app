import type { Database } from 'better-sqlite3'

export interface CachedClassification {
  fingerprint: string
  category: string
  subcategory: string | null
  suggestedName: string | null
  confidence: number
  engineVersion: string
  source: 'ai' | 'user-correction'
  classifiedAt: number
}

interface CacheRow {
  fingerprint: string
  category: string
  subcategory: string | null
  suggested_name: string | null
  confidence: number
  engine_version: string
  source: string
  classified_at: number
}

/**
 * Content-addressed classification memory. AI entries are valid only for the
 * engine version that produced them; user corrections never expire and are
 * never overwritten by AI results.
 */
export class ClassificationCacheRepo {
  constructor(private db: Database) {}

  get(fingerprint: string, currentEngineVersion: string): CachedClassification | null {
    const row = this.db
      .prepare('SELECT * FROM classification_cache WHERE fingerprint = ?')
      .get(fingerprint) as CacheRow | undefined
    if (!row) return null

    // Stale AI answers are misses; corrections are eternal
    if (row.source === 'ai' && row.engine_version !== currentEngineVersion) return null

    return {
      fingerprint: row.fingerprint,
      category: row.category,
      subcategory: row.subcategory,
      suggestedName: row.suggested_name,
      confidence: row.confidence,
      engineVersion: row.engine_version,
      source: row.source as CachedClassification['source'],
      classifiedAt: row.classified_at
    }
  }

  setFromAi(
    fingerprint: string,
    result: {
      category: string
      subcategory: string | null
      suggestedName: string | null
      confidence: number
    },
    engineVersion: string
  ): void {
    this.db
      .prepare(
        `INSERT INTO classification_cache
           (fingerprint, category, subcategory, suggested_name, confidence,
            engine_version, source, classified_at)
         VALUES (?, ?, ?, ?, ?, ?, 'ai', ?)
         ON CONFLICT(fingerprint) DO UPDATE SET
           category = excluded.category,
           subcategory = excluded.subcategory,
           suggested_name = excluded.suggested_name,
           confidence = excluded.confidence,
           engine_version = excluded.engine_version,
           classified_at = excluded.classified_at
         WHERE classification_cache.source != 'user-correction'`
      )
      .run(
        fingerprint,
        result.category,
        result.subcategory,
        result.suggestedName,
        result.confidence,
        engineVersion,
        Date.now()
      )
  }

  setCorrection(fingerprint: string, category: string, subcategory: string | null): void {
    this.db
      .prepare(
        `INSERT INTO classification_cache
           (fingerprint, category, subcategory, suggested_name, confidence,
            engine_version, source, classified_at)
         VALUES (?, ?, ?, NULL, 1.0, 'user', 'user-correction', ?)
         ON CONFLICT(fingerprint) DO UPDATE SET
           category = excluded.category,
           subcategory = excluded.subcategory,
           confidence = 1.0,
           engine_version = 'user',
           source = 'user-correction',
           classified_at = excluded.classified_at`
      )
      .run(fingerprint, category, subcategory, Date.now())
  }
}
