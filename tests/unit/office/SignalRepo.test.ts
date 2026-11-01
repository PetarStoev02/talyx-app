import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../../src/main/infrastructure/database/migrations'
import { SignalRepo } from '../../../src/main/domain/office/repository/SignalRepo'
import type { BotSignal } from '../../../src/main/domain/office/model'

const idle = (botId: string, at: string): BotSignal => ({ kind: 'idle', botId, at })

describe('SignalRepo', () => {
  let repo: SignalRepo
  let db: Database.Database
  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
    repo = new SignalRepo(db)
  })

  it('returns recent signals oldest first', () => {
    repo.append(idle('a', '2026-01-01T00:00:03Z'))
    repo.append(idle('a', '2026-01-01T00:00:01Z'))
    repo.append(idle('b', '2026-01-01T00:00:02Z'))
    repo.append(idle('c', '2026-01-01T00:00:02Z'))
    repo.append(idle('a', '2025-01-01T00:00:00Z'))
    const got = repo.recent(['a', 'b'], '2026-01-01T00:00:00Z')
    expect(got.map((s) => s.at)).toEqual([
      '2026-01-01T00:00:01Z',
      '2026-01-01T00:00:02Z',
      '2026-01-01T00:00:03Z'
    ])
    expect(repo.recent([], '2000-01-01T00:00:00Z')).toEqual([])
  })

  it('returns the feed newest first, capped', () => {
    for (let i = 1; i <= 5; i++) repo.append(idle('a', `2026-01-01T00:00:0${i}Z`))
    const got = repo.latestFeed(['a'], 2)
    expect(got.map((s) => s.at)).toEqual(['2026-01-01T00:00:05Z', '2026-01-01T00:00:04Z'])
    expect(repo.latestFeed([], 2)).toEqual([])
  })

  it('finds the owner of a thread from a task signal', () => {
    repo.append({
      kind: 'task',
      botId: 'a',
      task: 't',
      t3ThreadId: 'th',
      runId: null,
      at: '2026-01-01T00:00:01Z'
    })
    repo.append({
      kind: 't3',
      botId: 'b',
      t3ThreadId: 'th',
      title: 'x',
      status: 'running',
      link: null,
      at: '2026-01-01T00:00:02Z'
    })
    expect(repo.threadOwner('th')).toBe('a')
  })

  it('falls back to a t3 signal and returns null when unknown', () => {
    repo.append({
      kind: 't3',
      botId: 'b',
      t3ThreadId: 'th',
      title: 'x',
      status: 'running',
      link: null,
      at: '2026-01-01T00:00:02Z'
    })
    expect(repo.threadOwner('th')).toBe('b')
    expect(repo.threadOwner('zzz')).toBeNull()
  })

  it('lists distinct owned thread ids from task and t3 signals', () => {
    const task = (t3ThreadId: string | null): BotSignal => ({
      kind: 'task',
      botId: 'a',
      task: 'x',
      t3ThreadId,
      runId: null,
      at: '2026-01-01T00:00:01Z'
    })
    repo.append(task('t1'))
    repo.append(task('t1'))
    repo.append(task(null))
    repo.append({
      kind: 't3',
      botId: 'b',
      t3ThreadId: 't2',
      title: 'x',
      status: 'running',
      link: null,
      at: '2026-01-01T00:00:02Z'
    })
    expect(repo.ownedThreadIds().sort()).toEqual(['t1', 't2'])
  })

  it('excludes threads whose latest t3 signal is done and reports latest statuses', () => {
    const t3 = (t3ThreadId: string, status: 'running' | 'done', at: string): BotSignal => ({
      kind: 't3',
      botId: 'a',
      t3ThreadId,
      title: 'x',
      status,
      link: null,
      at
    })
    repo.append(t3('t1', 'running', '2026-01-01T00:00:01Z'))
    repo.append(t3('t1', 'done', '2026-01-01T00:00:02Z'))
    repo.append(t3('t2', 'running', '2026-01-01T00:00:03Z'))
    expect(repo.ownedThreadIds()).toEqual(['t2'])
    expect([...repo.latestT3Statuses()]).toEqual([
      ['t1', 'done'],
      ['t2', 'running']
    ])
  })

  it('should read an old group message as from the bot', () => {
    db.prepare('INSERT INTO signals (bot_id, kind, payload_json, at) VALUES (?, ?, ?, ?)').run(
      'a',
      'chat',
      JSON.stringify({
        kind: 'chat',
        botId: 'a',
        groupId: 'g',
        text: 'hi',
        at: '2026-01-01T00:00:01Z'
      }),
      '2026-01-01T00:00:01Z'
    )
    expect(repo.groupChat('g', 10)).toMatchObject([{ author: 'bot', messageId: null }])
  })

  it('should return the latest messages of a group oldest first', () => {
    for (let i = 1; i <= 3; i++) {
      repo.append({
        kind: 'chat',
        botId: 'a',
        groupId: 'g',
        text: `m${i}`,
        author: 'bot',
        messageId: null,
        at: `2026-01-01T00:00:0${i}Z`
      })
    }
    expect(repo.groupChat('g', 2).map((s) => s.at)).toEqual([
      '2026-01-01T00:00:02Z',
      '2026-01-01T00:00:03Z'
    ])
  })

  it('should find stored message ids and failed runs', () => {
    repo.append({
      kind: 'dm',
      botId: 'a',
      author: 'bot',
      text: 'x',
      messageId: 'm1',
      at: '2026-01-01T00:00:01Z'
    })
    repo.append({
      kind: 'task-failed',
      botId: 'a',
      runId: 'r1',
      reason: 'x',
      at: '2026-01-01T00:00:02Z'
    })
    expect(repo.hasMessageId('m1')).toBe(true)
    expect(repo.hasMessageId('zz')).toBe(false)
    expect(repo.hasOwnerMessageId('m1')).toBe(false)
    expect(repo.failedRunIds(['r1', 'r2'])).toEqual(new Set(['r1']))
    expect(repo.failedRunIds([])).toEqual(new Set())
  })
})
