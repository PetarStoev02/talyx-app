import Database from 'better-sqlite3'
import { runMigrations } from '../../../src/main/infrastructure/database/migrations'
import { RosterRepo } from '../../../src/main/domain/office/repository/RosterRepo'
import type { Bot } from '../../../src/main/domain/office/model'

export function emptyRoster(): RosterRepo {
  const db = new Database(':memory:')
  runMigrations(db)
  return new RosterRepo(db)
}

export function rosterWithBot(): RosterRepo {
  const roster = emptyRoster()
  roster.saveProject({ id: 'p', name: 'P', logoPath: null, windowView: 'none' })
  roster.saveGroup({ id: 'g', projectId: 'p', name: 'Team' })
  roster.saveBot(aBot())
  return roster
}

export function aBot(): Bot {
  return {
    id: 'b',
    projectId: 'p',
    name: 'B',
    color: '#ffffff',
    groupIds: ['g'],
    webhookUrl: null,
    t3ProjectIds: [],
    grokLink: null
  }
}

export function fakeSecrets(initial: Record<string, string> = {}): {
  values: Map<string, string>
  get: (name: string) => string | null
  set: (name: string, value: string) => void
  delete: (name: string) => void
} {
  const values = new Map(Object.entries(initial))
  return {
    values,
    get: (name) => values.get(name) ?? null,
    set: (name, value) => void values.set(name, value),
    delete: (name) => void values.delete(name)
  }
}
