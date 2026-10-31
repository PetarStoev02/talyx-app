import { describe, it, expect } from 'vitest'
import { parseBotEvent, parseT3ListenEvent } from '../../../src/main/domain/office/parseEvents'
import { InvalidEventError, UnknownBotError } from '../../../src/main/domain/office/errors'
import type { Bot, Group } from '../../../src/main/domain/office/model'

const now = new Date('2026-01-01T10:00:00.000Z')
const bot = (id: string, projectId = 'p1'): Bot => ({
  id,
  projectId,
  name: id,
  color: '#fff',
  groupIds: [],
  webhookUrl: null,
  t3ProjectIds: [],
  grokLink: null
})
const groups: Group[] = [
  { id: 'g1', projectId: 'p1', name: 'g1' },
  { id: 'g2', projectId: 'p2', name: 'g2' }
]
const ctx = { bots: [bot('a'), bot('b')], groups, now }
const owner = (id: string): string | null => (id === 't1' ? 'a' : null)

describe('parseBotEvent', () => {
  it('parses a chat event', () => {
    expect(parseBotEvent({ bot: 'a', kind: 'chat', group: 'g1', text: ' hi ' }, ctx)).toEqual({
      kind: 'chat',
      botId: 'a',
      groupId: 'g1',
      text: 'hi',
      at: now.toISOString()
    })
  })
  it('defaults at to now', () => {
    expect(parseBotEvent({ bot: 'a', kind: 'idle' }, ctx).at).toBe(now.toISOString())
  })
  it('normalizes and validates at', () => {
    expect(parseBotEvent({ bot: 'a', kind: 'idle', at: '2026-01-01T12:00:00+02:00' }, ctx).at).toBe(
      '2026-01-01T10:00:00.000Z'
    )
    expect(() => parseBotEvent({ bot: 'a', kind: 'idle', at: 'nope' }, ctx)).toThrow(/at/)
  })
  it('rejects an unknown bot', () => {
    expect(() => parseBotEvent({ bot: 'x', kind: 'idle' }, ctx)).toThrow(UnknownBotError)
  })
  it('rejects a non-object body and unknown kind', () => {
    expect(() => parseBotEvent('x', ctx)).toThrow(/body/)
    expect(() => parseBotEvent({ bot: 'a', kind: 'dance' }, ctx)).toThrow(/kind/)
  })
  it('rejects a chat without a group', () => {
    expect(() => parseBotEvent({ bot: 'a', kind: 'chat' }, ctx)).toThrow(InvalidEventError)
    expect(() => parseBotEvent({ bot: 'a', kind: 'chat' }, ctx)).toThrow(/group/)
  })
  it("rejects a chat for a group outside the bot's project", () => {
    expect(() => parseBotEvent({ bot: 'a', kind: 'chat', group: 'g2' }, ctx)).toThrow(/group/)
    expect(() => parseBotEvent({ bot: 'a', kind: 'chat', group: 'nope' }, ctx)).toThrow(/group/)
  })
  it('rejects a task without task text', () => {
    expect(() => parseBotEvent({ bot: 'a', kind: 'task', task: '  ' }, ctx)).toThrow(/task/)
  })
  it('parses task, result and message events', () => {
    expect(
      parseBotEvent({ bot: 'a', kind: 'task', task: 'x', t3ThreadId: 't', runId: 'r' }, ctx)
    ).toMatchObject({ kind: 'task', task: 'x', t3ThreadId: 't', runId: 'r' })
    expect(parseBotEvent({ bot: 'a', kind: 'result', text: 'ok' }, ctx)).toMatchObject({
      kind: 'result',
      runId: null
    })
    expect(parseBotEvent({ bot: 'a', kind: 'message', to: 'b', text: 'yo' }, ctx)).toMatchObject({
      kind: 'message',
      toBotId: 'b'
    })
    expect(() => parseBotEvent({ bot: 'a', kind: 'message', to: 'zz', text: 'yo' }, ctx)).toThrow(
      UnknownBotError
    )
  })
  it('caps text at 500 characters', () => {
    const s = parseBotEvent({ bot: 'a', kind: 'result', text: 'x'.repeat(900) }, ctx)
    expect(s.kind === 'result' && s.text).toHaveLength(500)
  })
})

describe('parseT3ListenEvent', () => {
  const ev = { threadId: 't1', title: 'Fix', createdAt: '2026-01-01T09:00:00.000Z' }
  it('maps request.opened to a waiting t3 signal for the owning bot', () => {
    expect(
      parseT3ListenEvent({ ...ev, event: 'request.opened' }, { threadOwner: owner, now })
    ).toEqual({
      kind: 't3',
      botId: 'a',
      t3ThreadId: 't1',
      title: 'Fix',
      status: 'waiting',
      link: null,
      at: '2026-01-01T09:00:00.000Z'
    })
  })
  it('maps resolved to running and thread end events to done', () => {
    const run = (name: string): unknown =>
      parseT3ListenEvent({ ...ev, kind: name }, { threadOwner: owner, now })
    expect(run('request.resolved')).toMatchObject({ status: 'running' })
    for (const n of ['thread-finished', 'thread.cancelled', 'thread-failed'])
      expect(run(n)).toMatchObject({ status: 'done' })
  })
  it('prefers completedAt', () => {
    const s = parseT3ListenEvent(
      { ...ev, type: 'thread.finished', completedAt: '2026-01-01T09:30:00.000Z' },
      { threadOwner: owner, now }
    )
    expect(s?.at).toBe('2026-01-01T09:30:00.000Z')
  })
  it('ignores a t3listen event for an unattributed thread', () => {
    expect(
      parseT3ListenEvent(
        { ...ev, threadId: 'zz', event: 'request.opened' },
        { threadOwner: owner, now }
      )
    ).toBeNull()
  })
  it('ignores the t3listen test event and unknown names', () => {
    expect(parseT3ListenEvent({ event: 'test' }, { threadOwner: owner, now })).toBeNull()
    expect(parseT3ListenEvent({ ...ev, event: 'other' }, { threadOwner: owner, now })).toBeNull()
  })
  it('rejects a missing threadId', () => {
    expect(() =>
      parseT3ListenEvent({ event: 'request.opened' }, { threadOwner: owner, now })
    ).toThrow(/threadId/)
  })
})
