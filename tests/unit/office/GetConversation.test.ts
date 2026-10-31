import { describe, it, expect } from 'vitest'
import type { BotSignal } from '../../../src/main/domain/office/model'
import { chatWorld, NOW } from './chat.setup'

const group = { kind: 'group', groupId: 'g' } as const
const bot = { kind: 'bot', botId: 'b' } as const
const at = (offsetMs: number): string => new Date(NOW.getTime() + offsetMs).toISOString()
const MIN = 60_000

const chat = (author: 'bot' | 'owner', text: string, when: string, id: string): BotSignal => ({
  kind: 'chat',
  botId: 'b',
  groupId: 'g',
  text,
  author,
  messageId: id,
  at: when
})

describe('GetConversation', () => {
  it('should show a group chat oldest first with owner and bot messages', () => {
    const w = chatWorld()
    expect(w.conversation.execute(group)).toEqual([])
    w.signals.append(chat('owner', 'one', at(-3 * MIN), 'a'))
    expect(w.conversation.execute(group)).toMatchObject([{ author: 'owner', text: 'one' }])
    w.signals.append(chat('bot', 'two', at(-2 * MIN), 'b'))
    w.signals.append(chat('owner', 'three', at(-1 * MIN), 'c'))
    expect(w.conversation.execute(group).map((m) => [m.author, m.text])).toEqual([
      ['owner', 'one'],
      ['b', 'two'],
      ['owner', 'three']
    ])
  })

  it('should mark an owner message without a reply after 10 minutes', () => {
    const w = chatWorld()
    w.signals.append(chat('owner', 'hi', at(-10 * MIN - 1000), 'a'))
    expect(w.conversation.execute(group)[0].status).toBe('no-reply')
  })

  it('should keep an owner message sent within 10 minutes', () => {
    const w = chatWorld()
    w.signals.append(chat('owner', 'hi', at(-9 * MIN), 'a'))
    expect(w.conversation.execute(group)[0].status).toBe('sent')
  })

  it('should keep an owner message sent when a bot replied after it', () => {
    const w = chatWorld()
    w.signals.append(chat('owner', 'hi', at(-30 * MIN), 'a'))
    w.signals.append(chat('bot', 'yo', at(-20 * MIN), 'b'))
    expect(w.conversation.execute(group)[0].status).toBe('sent')
  })

  it('should not count another owner message as a reply', () => {
    const w = chatWorld()
    w.signals.append(chat('owner', 'hi', at(-30 * MIN), 'a'))
    w.signals.append(chat('owner', 'hello?', at(-20 * MIN), 'b'))
    expect(w.conversation.execute(group).map((m) => m.status)).toEqual(['no-reply', 'no-reply'])
  })

  it('should show a bot’s tasks, results and T3 work in its chat', () => {
    const w = chatWorld()
    const base = { botId: 'b' }
    w.signals.append({
      ...base,
      kind: 'task',
      task: 'dig',
      t3ThreadId: null,
      runId: 'r1',
      at: at(-5 * MIN)
    })
    w.signals.append({ ...base, kind: 'result', runId: 'r1', text: 'dug', at: at(-4 * MIN) })
    w.signals.append({
      ...base,
      kind: 'task-failed',
      runId: 'r2',
      reason: 'timeout',
      at: at(-3 * MIN)
    })
    w.signals.append({
      ...base,
      kind: 't3',
      t3ThreadId: 't',
      title: 'Fix',
      status: 'running',
      link: null,
      at: at(-2 * MIN)
    })
    expect(w.conversation.execute(bot).map((m) => [m.kind, m.text])).toEqual([
      ['task', 'Started: dig'],
      ['result', 'Done: dug'],
      ['failed', 'Task failed: timeout'],
      ['t3', 'T3: Fix']
    ])
  })

  it('should fold a failed owner message into its status instead of a separate line', () => {
    const w = chatWorld()
    w.signals.append({
      kind: 'dm',
      botId: 'b',
      author: 'owner',
      text: 'hi',
      messageId: 'm1',
      at: at(-MIN)
    })
    w.signals.append({
      kind: 'task-failed',
      botId: 'b',
      runId: 'm1',
      reason: 'http_500',
      at: at(-MIN + 1)
    })
    expect(w.conversation.execute(bot)).toMatchObject([{ text: 'hi', status: 'failed' }])
  })

  it('should keep only the latest 200 messages', () => {
    const w = chatWorld()
    for (let i = 0; i < 205; i++)
      w.signals.append(chat('bot', `t${i}`, at(-(300 - i) * 1000), `id${i}`))
    const messages = w.conversation.execute(group)
    expect(messages).toHaveLength(200)
    expect(messages[0].text).toBe('t5')
    expect(messages.at(-1)?.text).toBe('t204')
  })
})
