import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../../src/main/infrastructure/database/migrations'
import { ActionLogRepo } from '../../../src/main/infrastructure/agent/ActionLogRepo'
import type { ActionLogEntry } from '../../../src/main/domain/agent/AgentSession'

function entry(
  proposalId: string,
  label: string,
  inverse: unknown | null,
  ok = true
): ActionLogEntry {
  return {
    sessionId: 's',
    proposalId,
    tool: 'sort_folder',
    label,
    payload: { p: label },
    inverse,
    ok,
    error: ok ? null : 'x'
  }
}

describe('ActionLogRepo', () => {
  let db: Database.Database
  let repo: ActionLogRepo
  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
    repo = new ActionLogRepo(db)
  })

  it('should return null when nothing was executed', () => {
    expect(repo.latestUndoable()).toBeNull()
  })

  it('should return the newest fully reversible proposal in execution order', () => {
    repo.append(entry('old', 'a', { u: 'a' }))
    repo.append(entry('new', 'b', { u: 'b' }))
    repo.append(entry('new', 'c', { u: 'c' }))
    expect(repo.latestUndoable()).toEqual([
      { tool: 'sort_folder', label: 'b', payload: { p: 'b' }, inverse: { u: 'b' } },
      { tool: 'sort_folder', label: 'c', payload: { p: 'c' }, inverse: { u: 'c' } }
    ])
  })

  it('should skip proposals with a failed or irreversible operation', () => {
    repo.append(entry('good', 'a', { u: 'a' }))
    repo.append(entry('irreversible', 'b', null))
    repo.append(entry('failed', 'c', { u: 'c' }, false))
    expect(repo.latestUndoable()).toEqual([
      { tool: 'sort_folder', label: 'a', payload: { p: 'a' }, inverse: { u: 'a' } }
    ])
  })

  it('should forget actions older than the retention, payloads and all', () => {
    repo.append(entry('old', 'a', null))
    repo.append(entry('new', 'b', { undo: 'b' }))
    const now = Date.now()
    const fortyDaysAgo = Math.floor(now / 1000) - 40 * 86_400
    db.prepare(`UPDATE agent_actions SET created_at = ? WHERE proposal_id = 'old'`).run(
      fortyDaysAgo
    )

    expect(repo.removeOlderThan(30, now)).toBe(1)
    expect(db.prepare('SELECT proposal_id FROM agent_actions').all()).toEqual([
      { proposal_id: 'new' }
    ])
  })

  it('should forget every action when the owner deletes all conversations', () => {
    repo.append(entry('p', 'a', { undo: 'a' }))

    repo.removeAll()

    expect(repo.latestUndoable()).toBeNull()
  })
})
