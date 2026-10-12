import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../../src/main/infrastructure/database/migrations'
import { ClassificationCacheRepo } from '../../../src/main/domain/classification/repository/ClassificationCacheRepo'

const CLAUDE_ENGINE = 'claude:claude-opus-5'
const ENGINE_VERSION = 'test-engine'

describe('the classification cache across sorters', () => {
  let db: Database.Database
  let repo: ClassificationCacheRepo

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
    repo = new ClassificationCacheRepo(db)
  })

  afterEach(() => {
    db.close()
  })

  const verdict = {
    category: 'Documents',
    subcategory: 'Reports',
    suggestedName: 'quarterly-report_20260701.pdf',
    confidence: 0.9
  }

  it('should not serve a local answer as Claude answered it', () => {
    repo.setFromAi('fp1', verdict, ENGINE_VERSION)
    expect(repo.get('fp1', CLAUDE_ENGINE)).toBeNull()
  })

  it('should not serve a Claude answer as the local models answered it', () => {
    repo.setFromAi('fp1', verdict, CLAUDE_ENGINE)
    expect(repo.get('fp1', ENGINE_VERSION)).toBeNull()
  })

  it('should serve its own answer back', () => {
    repo.setFromAi('fp1', verdict, CLAUDE_ENGINE)
    expect(repo.get('fp1', CLAUDE_ENGINE)?.category).toBe(verdict.category)
  })

  it('should not serve an answer from another Claude model', () => {
    repo.setFromAi('fp1', verdict, CLAUDE_ENGINE)
    expect(repo.get('fp1', 'claude:claude-haiku-4-5')).toBeNull()
  })

  it('should keep a user correction whichever model asks', () => {
    repo.setCorrection('fp1', 'Documents', 'Invoices')
    for (const engineVersion of [CLAUDE_ENGINE, ENGINE_VERSION, 'smart-local']) {
      const hit = repo.get('fp1', engineVersion)
      expect(hit).not.toBeNull()
      expect(hit?.subcategory).toBe('Invoices')
    }
  })
})
