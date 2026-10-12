import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../../src/main/infrastructure/database/migrations'
import { ClassificationCacheRepo } from '../../../src/main/domain/classification/repository/ClassificationCacheRepo'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  runMigrations(db)
  return db
}

describe('ClassificationCacheRepo', () => {
  let db: Database.Database
  let repo: ClassificationCacheRepo

  beforeEach(() => {
    db = createTestDb()
    repo = new ClassificationCacheRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  const aiResult = {
    category: 'Documents',
    subcategory: 'Invoices',
    suggestedName: 'acme-invoice_20260701.pdf',
    confidence: 0.9
  }

  it('should return a stored AI result for the current engine version', () => {
    repo.setFromAi('fp-1', aiResult, 'v1')
    const hit = repo.get('fp-1', 'v1')
    expect(hit?.category).toBe('Documents')
    expect(hit?.subcategory).toBe('Invoices')
    expect(hit?.source).toBe('ai')
  })

  it('should miss when nothing is stored', () => {
    expect(repo.get('unknown', 'v1')).toBeNull()
  })

  it('should treat AI entries from an older engine version as a miss', () => {
    repo.setFromAi('fp-1', aiResult, 'v1')
    expect(repo.get('fp-1', 'v2')).toBeNull()
  })

  it('should keep user corrections across engine versions', () => {
    repo.setCorrection('fp-1', 'Documents', 'Contracts')
    const hit = repo.get('fp-1', 'v99')
    expect(hit?.category).toBe('Documents')
    expect(hit?.subcategory).toBe('Contracts')
    expect(hit?.source).toBe('user-correction')
  })

  it('should never overwrite a user correction with an AI result', () => {
    repo.setCorrection('fp-1', 'Documents', 'Contracts')
    repo.setFromAi('fp-1', aiResult, 'v1')
    const hit = repo.get('fp-1', 'v1')
    expect(hit?.subcategory).toBe('Contracts')
    expect(hit?.source).toBe('user-correction')
  })

  it('should let a user correction overwrite an AI result', () => {
    repo.setFromAi('fp-1', aiResult, 'v1')
    repo.setCorrection('fp-1', 'Code', null)
    const hit = repo.get('fp-1', 'v1')
    expect(hit?.category).toBe('Code')
    expect(hit?.subcategory).toBeNull()
    expect(hit?.source).toBe('user-correction')
  })

  it('should refresh an AI entry when the same fingerprint is re-classified', () => {
    repo.setFromAi('fp-1', aiResult, 'v1')
    repo.setFromAi('fp-1', { ...aiResult, category: 'Images', subcategory: null }, 'v2')
    const hit = repo.get('fp-1', 'v2')
    expect(hit?.category).toBe('Images')
  })

  it('should store null suggestedName and subcategory', () => {
    repo.setFromAi(
      'fp-2',
      { category: 'Other', subcategory: null, suggestedName: null, confidence: 0.8 },
      'v1'
    )
    const hit = repo.get('fp-2', 'v1')
    expect(hit?.subcategory).toBeNull()
    expect(hit?.suggestedName).toBeNull()
  })
})
