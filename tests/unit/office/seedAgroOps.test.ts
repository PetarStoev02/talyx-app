import { describe, it, expect, vi } from 'vitest'
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

  it('rolls the seed back when a write fails', () => {
    const db = new Database(':memory:')
    runMigrations(db)
    const repo = new RosterRepo(db)
    const save = repo.saveBot.bind(repo)
    let calls = 0
    vi.spyOn(repo, 'saveBot').mockImplementation((b) => {
      if (++calls === 3) throw new Error('boom')
      save(b)
    })
    expect(() => seedAgroOps(repo)).toThrow('boom')
    expect(repo.listProjects()).toEqual([])
    expect(repo.listGroups('agro-ops')).toEqual([])
    expect(repo.allBots()).toEqual([])
  })
})
