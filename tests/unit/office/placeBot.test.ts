import { describe, it, expect } from 'vitest'
import { placeBot } from '../../../src/main/domain/office/placeBot'
import { MissingRoomError } from '../../../src/main/domain/office/errors'
import type { Bot, BotSignal, Placement, Room } from '../../../src/main/domain/office/model'

const NOW = new Date('2026-10-31T10:05:00Z')

function bot(overrides: Partial<Bot> = {}): Bot {
  return {
    id: 'b1',
    projectId: 'p1',
    name: 'Bot',
    color: '#fff',
    groupIds: ['team', 'client'],
    webhookUrl: null,
    t3ProjectIds: [],
    grokLink: null,
    ...overrides
  }
}

function rooms(): Room[] {
  return [
    { id: 'team-room', projectId: 'p1', name: 'Team', kind: 'conference', groupId: 'team' },
    { id: 'client-room', projectId: 'p1', name: 'Client', kind: 'conference', groupId: 'client' },
    { id: 'work', projectId: 'p1', name: 'Work', kind: 'work', groupId: null },
    { id: 'chill', projectId: 'p1', name: 'Chill', kind: 'chill', groupId: null }
  ]
}

const chat = (groupId: string, at: string, text: string | null = 'hi'): BotSignal => ({
  kind: 'chat',
  botId: 'b1',
  groupId,
  text,
  author: 'bot',
  messageId: null,
  at
})
const task = (at: string, text = 'do it'): BotSignal => ({
  kind: 'task',
  botId: 'b1',
  task: text,
  t3ThreadId: null,
  runId: null,
  at
})
const t3 = (status: 'running' | 'waiting' | 'done', at: string, id = 't1'): BotSignal => ({
  kind: 't3',
  botId: 'b1',
  t3ThreadId: id,
  title: `Thread ${id}`,
  status,
  link: 'link',
  at
})

function place(signals: BotSignal[], now = NOW, roomList: Room[] = rooms()): Placement {
  return placeBot({ bot: bot(), rooms: roomList, signals, now, staleMinutes: 15 })
}

describe('placeBot', () => {
  it('puts a bot in chill when it has no signals', () => {
    const p = place([])
    expect(p.roomId).toBe('chill')
    expect(p.lastSeenAt).toBeNull()
    expect(p.lastLine).toBeNull()
  })

  it("puts a chatting bot in its group's conference room", () => {
    expect(place([chat('client', '2026-10-31T10:04:00Z')]).roomId).toBe('client-room')
  })

  it('should not move the relay bot for an owner message', () => {
    const ownerChat: BotSignal = { ...chat('team', '2026-10-31T10:04:00Z'), author: 'owner' }
    const p = place([ownerChat])
    expect(p.roomId).toBe('chill')
    expect(p.lastLine).toBeNull()
  })

  it('should keep the bot where it was and its last words when the owner speaks after it', () => {
    const ownerChat: BotSignal = {
      ...chat('client', '2026-10-31T10:09:00Z', 'yo'),
      author: 'owner'
    }
    const p = place([chat('team', '2026-10-31T10:04:00Z', 'hello'), ownerChat])
    expect(p).toMatchObject({
      roomId: 'team-room',
      lastLine: 'hello',
      lastSeenAt: '2026-10-31T10:04:00Z'
    })
  })

  it('moves the bot to the room of the latest chat group', () => {
    const p = place([chat('team', '2026-10-31T10:01:00Z'), chat('client', '2026-10-31T10:03:00Z')])
    expect(p.roomId).toBe('client-room')
  })

  it('puts a bot with a reported task in the work room with the task text', () => {
    const p = place([task('2026-10-31T10:04:00Z', 'fix bug')])
    expect(p.roomId).toBe('work')
    expect(p.task).toBe('fix bug')
  })

  it('marks stale after staleMinutes', () => {
    const p = place([task('2026-10-31T10:00:00Z')], new Date('2026-10-31T10:16:00Z'))
    expect(p.roomId).toBe('chill')
    expect(p.stale).toBe(true)
  })

  it('keeps an observed running T3 thread in the work room even when old', () => {
    const p = place([t3('running', '2026-10-31T08:00:00Z')])
    expect(p.roomId).toBe('work')
    expect(p.task).toBe('Thread t1')
    expect(p.t3ThreadId).toBe('t1')
    expect(p.t3Link).toBe('link')
    expect(p.stale).toBe(false)
  })

  it('sets waiting when an attributed thread waits for an answer', () => {
    const p = place([
      t3('running', '2026-10-31T10:01:00Z', 'a'),
      t3('waiting', '2026-10-31T10:02:00Z', 'b')
    ])
    expect(p.roomId).toBe('work')
    expect(p.waiting).toBe(true)
  })

  it('returns to chill after a result and keeps the result as lastLine', () => {
    const p = place([
      task('2026-10-31T10:01:00Z'),
      { kind: 'result', botId: 'b1', runId: null, text: 'all done', at: '2026-10-31T10:03:00Z' }
    ])
    expect(p.roomId).toBe('chill')
    expect(p.lastLine).toBe('all done')
  })

  it('returns to chill after a failed task', () => {
    const p = place([
      task('2026-10-31T10:01:00Z'),
      { kind: 'task-failed', botId: 'b1', runId: null, reason: 'boom', at: '2026-10-31T10:03:00Z' }
    ])
    expect(p.roomId).toBe('chill')
  })

  it('should not count an owner message or a failed task as hearing from the bot', () => {
    const seen = '2026-10-31T09:00:00Z'
    const p = place([
      chat('team', seen),
      {
        kind: 'dm',
        botId: 'b1',
        author: 'owner',
        text: 'hello?',
        messageId: 'm1',
        at: '2026-10-31T10:03:00Z'
      },
      { kind: 'task-failed', botId: 'b1', runId: 'm1', reason: 'boom', at: '2026-10-31T10:04:00Z' }
    ])
    expect(p.lastSeenAt).toBe(seen)
    expect(p.stale).toBe(true)
  })

  it('falls back to chill when a thread is done', () => {
    const p = place([t3('running', '2026-10-31T10:01:00Z'), t3('done', '2026-10-31T10:02:00Z')])
    expect(p.roomId).toBe('chill')
  })

  it('puts a bot in chill when its chat group has no conference room', () => {
    expect(place([chat('other', '2026-10-31T10:04:00Z')]).roomId).toBe('chill')
  })

  it('is not stale at exactly staleMinutes', () => {
    const p = place([task('2026-10-31T10:00:00Z')], new Date('2026-10-31T10:15:00Z'))
    expect(p.roomId).toBe('work')
    expect(p.stale).toBe(false)
  })

  it('marks a stale chat as stale in chill', () => {
    const p = place([chat('team', '2026-10-31T10:00:00Z')], new Date('2026-10-31T10:16:00Z'))
    expect(p.roomId).toBe('chill')
    expect(p.stale).toBe(true)
  })

  it('throws MissingRoomError only when the needed room is missing', () => {
    const noWork = rooms().filter((r) => r.kind !== 'work')
    expect(place([chat('team', '2026-10-31T10:04:00Z')], NOW, noWork).roomId).toBe('team-room')
    expect(() => place([task('2026-10-31T10:04:00Z')], NOW, noWork)).toThrow(MissingRoomError)
  })
})
