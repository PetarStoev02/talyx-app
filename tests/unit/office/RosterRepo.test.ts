import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../../src/main/infrastructure/database/migrations'
import { RosterRepo } from '../../../src/main/domain/office/repository/RosterRepo'
import { ProjectNotFoundError } from '../../../src/main/domain/office/errors'
import type { Bot } from '../../../src/main/domain/office/model'

describe('RosterRepo', () => {
  let repo: RosterRepo
  let db: Database.Database
  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
    repo = new RosterRepo(db)
    repo.saveProject({ id: 'p', name: 'P', logoPath: null, windowView: 'none' })
    repo.saveGroup({ id: 'g1', projectId: 'p', name: 'One' })
    repo.saveGroup({ id: 'g2', projectId: 'p', name: 'Two' })
  })

  it('round-trips a bot with two groups and mapped T3 projects', () => {
    const bot: Bot = {
      id: 'b',
      projectId: 'p',
      name: 'B',
      color: '#fff',
      groupIds: ['g1', 'g2'],
      webhookUrl: 'http://x',
      t3ProjectIds: ['t1', 't2'],
      grokLink: null
    }
    repo.saveBot(bot)
    expect(repo.listBots('p')).toEqual([bot])
    repo.saveBot({ ...bot, groupIds: ['g1'], t3ProjectIds: [] })
    expect(repo.allBots()[0].groupIds).toEqual(['g1'])
    expect(repo.allBots()[0].t3ProjectIds).toEqual([])
    repo.deleteBot('b')
    expect(repo.allBots()).toEqual([])
  })

  it('round-trips rooms and groups', () => {
    repo.saveRoom({ id: 'r', projectId: 'p', name: 'R', kind: 'conference', groupId: 'g1' })
    expect(repo.listRooms('p')).toHaveLength(1)
    expect(repo.listGroups('p')).toHaveLength(2)
    expect(repo.listProjects()).toHaveLength(1)
  })

  it('throws ProjectNotFoundError for an unknown project', () => {
    expect(() => repo.getProject('nope')).toThrow(ProjectNotFoundError)
  })

  const bot: Bot = {
    id: 'b',
    projectId: 'p',
    name: 'B',
    color: '#fff',
    groupIds: ['g1'],
    webhookUrl: null,
    t3ProjectIds: ['t1'],
    grokLink: null
  }
  const linkCount = (): number =>
    db
      .prepare('SELECT (SELECT COUNT(*) FROM bot_groups) + (SELECT COUNT(*) FROM bot_t3_projects)')
      .pluck()
      .get() as number

  it("removes a deleted bot's group and T3 links", () => {
    repo.saveBot(bot)
    expect(linkCount()).toBe(2)
    repo.deleteBot('b')
    expect(linkCount()).toBe(0)
  })

  it('rejects a bot with an unknown group and saves nothing', () => {
    expect(() => repo.saveBot({ ...bot, groupIds: ['missing'] })).toThrow()
    expect(repo.allBots()).toEqual([])
    expect(linkCount()).toBe(0)
  })
})
