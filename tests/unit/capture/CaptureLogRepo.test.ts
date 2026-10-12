import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../../src/main/infrastructure/database/migrations'
import { CaptureLogRepo } from '../../../src/main/domain/capture/CaptureLogRepo'

describe('CaptureLogRepo', () => {
  let repo: CaptureLogRepo
  beforeEach(() => {
    const db = new Database(':memory:')
    runMigrations(db)
    repo = new CaptureLogRepo(db)
  })

  it('should key a recorded capture by its local calendar day', () => {
    const entry = repo.record({ destination: 'note', at: new Date(2026, 8, 5, 10) })
    expect(entry.dayKey).toBe('2026-09-05')
    expect(entry.destination).toBe('note')
  })
})
