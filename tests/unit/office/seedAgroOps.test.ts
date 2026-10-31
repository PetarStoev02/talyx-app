import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../../src/main/infrastructure/database/migrations'
import { RosterRepo } from '../../../src/main/domain/office/repository/RosterRepo'
import { seedAgroOps } from '../../../src/main/domain/office/seedAgroOps'

describe('seedAgroOps', () => {
  it('seeds AgroOps once', () => {
    const db = new Database(':memory:')
    runMigrations(db)
    const repo = new RosterRepo(db)
    seedAgroOps(repo)
    seedAgroOps(repo)
    expect(repo.allBots()).toHaveLength(11)
    expect(repo.listGroups('agro-ops')).toHaveLength(2)
    expect(repo.listRooms('agro-ops')).toHaveLength(4)
    const tots = repo.allBots().find((b) => b.id === 'agro-ops-t3-tots')
    expect(tots?.t3ProjectIds).toHaveLength(2)
    const grok = repo.allBots().find((b) => b.id === 'agro-ops-grok-bot')
    expect(grok?.groupIds).toEqual(['agro-ops-team', 'agro-ops-clients'])
  })
})
