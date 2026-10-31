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
      author: 'bot',
      messageId: null,
      at: now.toISOString()
    })
  })
  it('defaults at to now', () => {
    expect(parseBotEvent({ bot: 'a', kind: 'idle' }, ctx).at).toBe(now.toISOString())
  })
  it('uses the receive time even when the bot sends a future at', () => {
    expect(parseBotEvent({ bot: 'a', kind: 'idle', at: '2099-01-01T00:00:00Z' }, ctx).at).toBe(
      now.toISOString()
    )
    expect(parseBotEvent({ bot: 'a', kind: 'idle', at: '2020-01-01T00:00:00Z' }, ctx).at).toBe(
      now.toISOString()
    )
  })
  it('still validates at', () => {
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
  it('caps ids and titles at 200 characters', () => {
    const long = 'x'.repeat(10_000)
    const big = { ...ctx, bots: [bot('a'), bot('b'.repeat(200))] }
    const s = parseBotEvent(
      { bot: 'a', kind: 'task', task: 't', t3ThreadId: long, runId: long },
      big
    )
    expect(s).toMatchObject({ t3ThreadId: 'x'.repeat(200), runId: 'x'.repeat(200) })
    const m = parseBotEvent({ bot: 'a', kind: 'message', to: 'b'.repeat(10_000), text: 'y' }, big)
    expect(m).toMatchObject({ toBotId: 'b'.repeat(200) })
    const t = parseT3ListenEvent(
      { event: 'request.opened', threadId: long, title: long },
      { threadOwner: () => 'a', now }
    )
    expect(t).toMatchObject({ t3ThreadId: 'x'.repeat(200), title: 'x'.repeat(200) })
  })
  it('does not echo a long group value in the error', () => {
    const run = (): unknown =>
      parseBotEvent({ bot: 'a', kind: 'chat', group: 'g'.repeat(10_000) }, ctx)
    expect(run).toThrow(InvalidEventError)
    try {
      run()
    } catch (err) {
      expect((err as Error).message.length).toBeLessThan(100)
      expect((err as Error).message).not.toContain('ggg')
    }
  })
  it('caps result text at 4000 characters', () => {
    const s = parseBotEvent({ bot: 'a', kind: 'result', text: 'x'.repeat(5000) }, ctx)
    expect(s.kind === 'result' && s.text).toHaveLength(4000)
  })
  it('caps a task at 500 characters', () => {
    const s = parseBotEvent({ bot: 'a', kind: 'task', task: 'x'.repeat(900) }, ctx)
    expect(s.kind === 'task' && s.task).toHaveLength(500)
  })
  it('should read a group message from the owner', () => {
    const body = {
      bot: 'b',
      kind: 'chat',
      group: 'g1',
      text: 'hi',
      author: 'owner',
      messageId: 'm1'
    }
    expect(parseBotEvent(body, ctx)).toMatchObject({ author: 'owner', messageId: 'm1' })
  })
  it('should default a group message author to bot', () => {
    const body = { bot: 'b', kind: 'chat', group: 'g1', text: 'hi' }
    expect(parseBotEvent(body, ctx)).toMatchObject({ author: 'bot', messageId: null })
  })
  it('should reject an unknown author', () => {
    const body = { bot: 'b', kind: 'chat', group: 'g1', text: 'hi', author: 'admin' }
    expect(() => parseBotEvent(body, ctx)).toThrow(expect.objectContaining({ field: 'author' }))
  })
  it.each(['bot', 'owner'])('should read a direct message from the %s', (author) => {
    const s = parseBotEvent({ bot: 'b', kind: 'dm', text: 'x', author }, ctx)
    expect(s).toMatchObject({ kind: 'dm', botId: 'b', author, text: 'x', messageId: null })
  })
  it('should require text on a direct message', () => {
    expect(() => parseBotEvent({ bot: 'b', kind: 'dm' }, ctx)).toThrow(
      expect.objectContaining({ field: 'text' })
    )
  })
  it('should keep 4000 characters of a reply', () => {
    const text = 'a"b\n'.repeat(1000)
    const s = parseBotEvent({ bot: 'b', kind: 'dm', text: text + 'tail' }, ctx)
    expect(s.kind === 'dm' && s.text).toBe(text)
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
      at: now.toISOString()
    })
  })
  it('maps resolved to running and thread end events to done', () => {
    const run = (name: string): unknown =>
      parseT3ListenEvent({ ...ev, kind: name }, { threadOwner: owner, now })
    expect(run('request.resolved')).toMatchObject({ status: 'running' })
    for (const n of ['thread-finished', 'thread.cancelled', 'thread-failed'])
      expect(run(n)).toMatchObject({ status: 'done' })
  })
  it('uses the receive time even when the event carries a future completedAt', () => {
    const s = parseT3ListenEvent(
      { ...ev, type: 'thread.finished', completedAt: '2099-01-01T00:00:00.000Z' },
      { threadOwner: owner, now }
    )
    expect(s?.at).toBe(now.toISOString())
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
  it('ignores a t3listen event named like an object prototype key', () => {
    for (const name of ['constructor', 'toString', '__proto__'])
      expect(parseT3ListenEvent({ ...ev, event: name }, { threadOwner: owner, now })).toBeNull()
  })
  it('rejects a missing threadId', () => {
    expect(() =>
      parseT3ListenEvent({ event: 'request.opened' }, { threadOwner: owner, now })
    ).toThrow(/threadId/)
  })
})
