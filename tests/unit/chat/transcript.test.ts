import { describe, expect, it } from 'vitest'
import {
  addPrompt,
  applyEvent,
  fromHistory,
  needsRebuild,
  settlePrompt
} from '../../../src/renderer/src/features/chat/transcript'
import type { ChatPrompt, Transcript } from '../../../src/renderer/src/features/chat/types'
import type { GatewayEvent } from '../../../src/renderer/src/shared/engine/shared'
import type { SessionMessage } from '../../../src/renderer/src/shared/engine/types'

const SESSION = 'chat-1'

const event = (type: string, payload: Record<string, unknown> = {}, seq?: number): GatewayEvent =>
  ({ type, payload, session_id: SESSION, ...(seq === undefined ? {} : { seq }) }) as GatewayEvent

const history = (...rows: SessionMessage[]): Transcript => fromHistory(SESSION, rows, false)

const empty = (): Transcript => history()

const replay = (transcript: Transcript, ...events: GatewayEvent[]): Transcript =>
  events.reduce(applyEvent, transcript)

const clarify = (): ChatPrompt => ({
  kind: 'clarify',
  id: 'prompt-1',
  questions: [{ qid: 'q1', question: 'Which quarter?', choices: ['Q3', 'Q4'], multiSelect: false }],
  answers: {}
})

describe('chat transcript', () => {
  describe('from history', () => {
    it('should build user, bot, tool and notice items from history', () => {
      const transcript = history(
        { id: 1, role: 'user', content: 'Summarise Q3' },
        {
          id: 2,
          role: 'assistant',
          content: '',
          tool_calls: [
            { id: 'call-1', function: { name: 'message_agent', arguments: '{"target":"cfo"}' } }
          ]
        },
        { id: 3, role: 'tool', content: '{"ok":true}', tool_call_id: 'call-1' },
        { id: 4, role: 'user', content: 'Message from 🤖 CFO (@cfo): done' },
        { id: 5, role: 'assistant', content: [{ type: 'text', text: 'Margins are up.' }] }
      )
      expect(transcript.items).toEqual([
        { kind: 'user', id: '1', text: 'Summarise Q3', images: [] },
        {
          kind: 'tool',
          id: '3',
          name: 'message_agent',
          label: 'message_agent',
          seconds: null,
          done: true,
          target: 'cfo'
        },
        { kind: 'notice', id: '4', text: 'Message from 🤖 CFO (@cfo): done' },
        { kind: 'bot', id: '5', text: 'Margins are up.', streaming: false, error: null }
      ])
    })

    it('should move attached images out of the user text', () => {
      const [item] = history({
        id: 1,
        role: 'user',
        content: 'Look at this\n@image:/tmp/a.png\n[Image attached: /tmp/b.jpg]'
      }).items
      expect(item).toEqual({
        kind: 'user',
        id: '1',
        text: 'Look at this',
        images: ['/tmp/a.png', '/tmp/b.jpg']
      })
    })

    it('should label a tool line from its labels', () => {
      const [item] = history({
        id: 1,
        role: 'tool',
        name: 'terminal',
        content: 'ok',
        labels: [
          {
            kind: 'tool',
            app: 'Shell',
            action: 'run',
            emoji: '',
            text: 'terminal',
            name: 'terminal'
          }
        ]
      } as SessionMessage).items
      expect(item).toMatchObject({ kind: 'tool', name: 'terminal', label: 'terminal' })
    })

    it('should skip hidden history rows', () => {
      expect(
        history({ id: 1, role: 'user', content: 'secret', display_kind: 'hidden' }).items
      ).toEqual([])
    })
  })

  describe('live events', () => {
    it('should stream a reply from start, delta and complete events', () => {
      const transcript = replay(
        empty(),
        event('message.start', {}, 1),
        event('message.delta', { text: 'Hel' }, 2),
        event('message.delta', { text: 'lo' }, 3)
      )
      expect(transcript.running).toBe(true)
      expect(transcript.items.at(-1)).toMatchObject({ kind: 'bot', text: 'Hello', streaming: true })
      const done = applyEvent(transcript, event('message.complete', { text: 'Hello' }, 4))
      expect(done.running).toBe(false)
      expect(done.items).toHaveLength(1)
      expect(done.items[0]).toMatchObject({ kind: 'bot', text: 'Hello', streaming: false })
    })

    it('should ignore a replayed event it already applied', () => {
      const transcript = replay(
        empty(),
        event('message.start', {}, 1),
        event('message.delta', { text: 'Hi' }, 2),
        event('message.delta', { text: 'Hi' }, 2),
        event('message.start', {}, 1)
      )
      expect(transcript.items).toHaveLength(1)
      expect(transcript.items[0]).toMatchObject({ text: 'Hi' })
    })

    it('should show a failed turn as an error on the reply', () => {
      const transcript = replay(
        empty(),
        event('message.start', {}, 1),
        event('message.complete', { status: 'error', error: 'Provider down' }, 2)
      )
      expect(transcript.items[0]).toMatchObject({
        kind: 'bot',
        streaming: false,
        error: 'Provider down'
      })
    })

    it('should turn tool start and complete into one finished tool line with seconds', () => {
      const transcript = replay(
        empty(),
        event('tool.start', { tool_id: 't1', name: 'terminal' }, 1),
        event('tool.complete', { tool_id: 't1', name: 'terminal', duration_s: 2 }, 2)
      )
      expect(transcript.items).toEqual([
        {
          kind: 'tool',
          id: 't1',
          name: 'terminal',
          label: 'terminal',
          seconds: 2,
          done: true,
          target: null
        }
      ])
    })

    it('should split a reply around the tool lines it ran', () => {
      const transcript = replay(
        empty(),
        event('message.start', {}, 1),
        event('message.delta', { text: 'Checking.' }, 2),
        event('tool.start', { tool_id: 't1', name: 'terminal' }, 3),
        event('tool.complete', { tool_id: 't1', name: 'terminal' }, 4),
        event('message.delta', { text: 'Done.' }, 5),
        event('message.complete', { text: 'Checking.Done.' }, 6)
      )
      expect(
        transcript.items.map((item) => [item.kind, 'text' in item ? item.text : item.id])
      ).toEqual([
        ['bot', 'Checking.'],
        ['tool', 't1'],
        ['bot', 'Done.']
      ])
      expect(transcript.items.some((item) => item.kind === 'bot' && item.streaming)).toBe(false)
    })

    it('should name the bot a message_agent call asks', () => {
      const transcript = applyEvent(
        empty(),
        event('tool.start', { tool_id: 't1', name: 'message_agent', args: { target: 'cfo' } }, 1)
      )
      expect(transcript.items[0]).toMatchObject({ target: 'cfo', done: false })
    })

    it('should follow the running flag from session info', () => {
      expect(applyEvent(empty(), event('session.info', { running: true }, 1)).running).toBe(true)
    })
  })

  describe('cards', () => {
    it('should keep one card per prompt id and drop it once settled', () => {
      const shown = addPrompt(addPrompt(empty(), clarify()), clarify())
      expect(shown.prompts).toHaveLength(1)
      const settled = applyEvent(shown, event('clarify.settled', { prompt_id: 'prompt-1' }, 1))
      expect(settled.prompts).toEqual([])
      expect(settlePrompt(shown, 'prompt-1').prompts).toEqual([])
    })
  })

  it('should ask for a rebuild on a replay gap or a rewind', () => {
    expect(needsRebuild(event('session.replay_gap'))).toBe(true)
    expect(needsRebuild(event('session.updated', { operation: 'rewind' }))).toBe(true)
    expect(needsRebuild(event('session.updated', { operation: 'model' }))).toBe(false)
    expect(needsRebuild(event('message.delta', { text: 'x' }))).toBe(false)
  })
})
