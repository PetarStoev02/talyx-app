import { describe, expect, it } from 'vitest'
import { turnOutcome, turnView } from '../../../src/renderer/src/features/chat/turns'
import type { ChatItem } from '../../../src/renderer/src/features/chat/types'

const user = (id: string, text = 'Summarise Q3'): ChatItem => ({
  kind: 'user',
  id,
  text,
  images: []
})

const reply = (id: string, text: string, error: string | null = null): ChatItem => ({
  kind: 'bot',
  id,
  text,
  streaming: false,
  error,
  stopped: false,
  sender: null
})

const tool = (id: string, name = 'search_files', target: string | null = null): ChatItem => ({
  kind: 'tool',
  id,
  name,
  label: name,
  seconds: null,
  done: true,
  target
})

const ids = (items: ChatItem[]): string[] => items.map((item) => item.id)

describe('turn view', () => {
  describe('a finished turn', () => {
    it('should show nothing for an empty chat', () => {
      expect(turnView([], false)).toEqual({ items: [], activity: null })
    })

    it('should keep your message and the answer of a turn with no tools', () => {
      const { items } = turnView([user('u1'), reply('b1', 'Margins are up.')], false)
      expect(ids(items)).toEqual(['u1', 'b1'])
    })

    it('should drop the one tool line and keep the answer', () => {
      const { items } = turnView([user('u1'), tool('t1'), reply('b1', 'Done.')], false)
      expect(ids(items)).toEqual(['u1', 'b1'])
    })

    it('should drop many tools, the text between them and the asked lines', () => {
      const { items, activity } = turnView(
        [
          user('u1'),
          reply('b1', 'Let me check the files...'),
          tool('t1'),
          tool('t2', 'message_agent', 'cfo'),
          reply('b2', 'Now the numbers.'),
          tool('t3', 'computer_use'),
          reply('b3', 'Margins are up.')
        ],
        false
      )
      expect(ids(items)).toEqual(['u1', 'b3'])
      expect(activity).toBeNull()
    })

    it('should keep notices, deliveries, errors and each turn of an old chat', () => {
      const delivery: ChatItem = {
        ...reply('d1', 'Costs flat'),
        sender: { name: 'CFO', profile: 'cfo' }
      }
      const { items } = turnView(
        [
          user('u1'),
          tool('t1'),
          reply('b1', 'Asked the CFO.'),
          { kind: 'notice', id: 'n1', text: 'Job finished' },
          delivery,
          tool('t2'),
          reply('b2', 'Costs are flat.'),
          user('u2', 'And Q4?'),
          reply('b3', '', 'The provider timed out'),
          tool('t3'),
          reply('b4', 'Q4 is pending.')
        ],
        false
      )
      expect(ids(items)).toEqual(['u1', 'b1', 'n1', 'd1', 'b2', 'u2', 'b3', 'b4'])
    })
  })

  describe('a running turn', () => {
    it('should show the activity with no tool before the first one', () => {
      expect(turnView([user('u1')], true)).toEqual({
        items: [user('u1')],
        activity: { tool: null, tools: 0 }
      })
    })

    it('should show one activity with the newest tool and the count, never the tool lines', () => {
      const newest = tool('t3', 'computer_use')
      const { items, activity } = turnView(
        [user('u1'), tool('t1'), reply('b1', 'Let me check...'), tool('t2'), newest],
        true
      )
      expect(ids(items)).toEqual(['u1'])
      expect(activity).toEqual({ tool: newest, tools: 3 })
    })

    it('should show the reply streaming before any tool, as the answer it is', () => {
      const { items, activity } = turnView(
        [user('u1'), { ...reply('b1', 'Margins'), streaming: true }],
        true
      )
      expect(ids(items)).toEqual(['u1', 'b1'])
      expect(activity).toEqual({ tool: null, tools: 0 })
    })

    it('should show no empty bubble before the first text, only the activity', () => {
      const { items, activity } = turnView(
        [user('u1'), { ...reply('b1', ''), streaming: true }],
        true
      )
      expect(ids(items)).toEqual(['u1'])
      expect(activity).toEqual({ tool: null, tools: 0 })
    })

    it('should show the reply streaming after the last tool', () => {
      const { items, activity } = turnView(
        [user('u1'), tool('t1'), { ...reply('b1', 'Margins'), streaming: true }],
        true
      )
      expect(ids(items)).toEqual(['u1', 'b1'])
      expect(activity).toEqual({ tool: tool('t1'), tools: 1 })
    })

    it('should count only the tools of the turn still running', () => {
      const { items, activity } = turnView(
        [user('u1'), tool('t1'), reply('b1', 'Done.'), user('u2'), tool('t2')],
        true
      )
      expect(ids(items)).toEqual(['u1', 'b1', 'u2'])
      expect(activity?.tools).toBe(1)
    })
  })
})

describe('turn outcome', () => {
  const kind = (items: ChatItem[], running = false): string | null =>
    turnOutcome(items, running)?.kind ?? null
  const stopped: ChatItem = { ...reply('b1', ''), stopped: true }
  const delivery: ChatItem = {
    ...reply('d1', 'Costs flat'),
    sender: { name: 'CFO', profile: 'cfo' }
  }

  it('should have none for an empty chat or one still running', () => {
    expect(kind([])).toBeNull()
    expect(kind([user('u1')], true)).toBeNull()
    expect(kind([user('u1'), reply('b1', 'Half', null)], true)).toBeNull()
  })

  it('should name the message an answered turn answered, so the answer can be asked for again', () => {
    expect(turnOutcome([user('u1'), tool('t1'), reply('b1', 'Done.')], false)).toEqual({
      kind: 'answered',
      asked: user('u1')
    })
    // A stop that left part of an answer is an answer too.
    expect(kind([user('u1'), { ...reply('b1', 'Margins are'), stopped: true }])).toBe('answered')
  })

  it('should have none for an answer the engine has not stored yet', () => {
    expect(kind([user('local-1'), reply('live-1', 'Done.')])).toBeNull()
    // A turn another client started streams in under the earlier stored message.
    expect(kind([user('u1'), reply('b1', 'Hi'), reply('live-2', 'Done.')])).toBeNull()
  })

  it('should have none while your message is still on its way', () => {
    expect(kind([user('local-1')])).toBeNull()
  })

  it('should have none once something else came in after your message', () => {
    expect(kind([user('u1'), delivery])).toBeNull()
  })

  it('should say a turn ended without a reply when it gave none, tools or not', () => {
    expect(kind([user('u1')])).toBe('noReply')
    expect(kind([user('u1'), tool('t1'), tool('t2'), reply('b1', '')])).toBe('noReply')
  })

  it('should say a turn was stopped before any text, and show no empty bubble for it', () => {
    expect(kind([user('u1'), stopped])).toBe('stopped')
    expect(ids(turnView([user('u1'), stopped], false).items)).toEqual(['u1'])
  })

  it('should say a turn failed and name the message to send again', () => {
    expect(turnOutcome([user('u1'), reply('b1', '', 'Rate limited')], false)).toEqual({
      kind: 'failed',
      asked: user('u1')
    })
  })
})
