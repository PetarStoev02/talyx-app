import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  LIVE_ID,
  addPrompt,
  applyEvent,
  fromHistory,
  needsRebuild,
  senderProfile,
  settlePrompt,
  waitLeft,
  withManagerName
} from '../../../src/renderer/src/features/chat/transcript'
import type { ChatPrompt, Transcript } from '../../../src/renderer/src/features/chat/types'
import type { GatewayEvent } from '../../../src/renderer/src/shared/engine/shared'
import type { SessionMessage } from '../../../src/renderer/src/shared/engine/types'
import { turnFrames } from './turnFrames'

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
          target: 'cfo',
          showUi: null
        },
        { kind: 'delivery', id: '4', text: 'done', from: { name: 'CFO', profile: 'cfo' } },
        {
          kind: 'bot',
          id: '5',
          text: 'Margins are up.',
          streaming: false,
          error: null,
          stopped: false,
          sender: null
        }
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

    describe('engine text in your own messages', () => {
      const PATH = '/cache/native-inputs/abc/image_9e15cd.png'
      const SEEN =
        "[The user sent an image~ Here's what I can see:\nA sidebar [with brackets] lists three bots.]\n" +
        `[If you need a closer look, use vision_analyze with image_url: ${PATH} ~]`
      const RESTATED =
        `[STILL IN PROGRESS ${String.fromCharCode(0x2014)} this is the active request, restated after the compaction ` +
        'boundary because it was not finished yet. Continue it; do not start over.]\n'
      const user = (id: number, content: string): SessionMessage => ({ id, role: 'user', content })

      it('should show the typed text and the image, not its description or path', () => {
        const [item] = history(user(1, `${SEEN}\n\nMake the names match`)).items
        expect(item).toEqual({
          kind: 'user',
          id: '1',
          text: 'Make the names match',
          images: [PATH]
        })
      })

      it.each([
        "[The user sent an image but I couldn't quite see it this time (>_<) You can try looking at it yourself with vision_analyze using image_url: /cache/a.png]",
        '[The user sent an image but something went wrong when I tried to look at it~ You can try examining it yourself with vision_analyze using image_url: /cache/a.png]'
      ])('should show only the image when the engine could not see it: %s', (note) => {
        const [item] = history(user(1, `${note}\n\nWhat is this?`)).items
        expect(item).toMatchObject({ text: 'What is this?', images: ['/cache/a.png'] })
      })

      it('should show each image of several, and none of their notes', () => {
        const second = SEEN.replace(PATH, '/cache/b.png')
        const [item] = history(user(1, `${SEEN}\n\n${second}`)).items
        expect(item).toMatchObject({ text: '', images: [PATH, '/cache/b.png'] })
      })

      it('should show a request restated after compaction once, as you wrote it', () => {
        const transcript = history(
          user(1, 'Draft the Q3 report'),
          { id: 2, role: 'assistant', content: 'Working on it.' },
          user(3, `${RESTATED}Draft the Q3 report`)
        )
        expect(transcript.items.filter((item) => item.kind === 'user')).toEqual([
          { kind: 'user', id: '1', text: 'Draft the Q3 report', images: [] }
        ])
      })

      it('should show a restated request whose original is gone, without the header', () => {
        const [item] = history(user(1, `${RESTATED}Draft the Q3 report`)).items
        expect(item).toMatchObject({ kind: 'user', text: 'Draft the Q3 report' })
      })

      it('should strip a restated request that carries an image note', () => {
        const [item] = history(user(1, `${RESTATED}${SEEN}\n\nDraft the Q3 report`)).items
        expect(item).toMatchObject({ text: 'Draft the Q3 report', images: [PATH] })
      })

      it.each([
        '[The user sent an image] is what I want the bot to say',
        'Use [STILL IN PROGRESS] as the status label',
        'See [docs](https://example.com) and [If you need a closer look] notes'
      ])('should leave plain text with square brackets alone: %s', (text) => {
        const [item] = history(user(1, text)).items
        expect(item).toEqual({ kind: 'user', id: '1', text, images: [] })
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

    describe('bot-to-bot traffic', () => {
      const delivered =
        'Message from 🤖 Agro Ops CFO (@agro-ops-cfo): Margins are up.\n\n- Costs flat'

      it('should show a message another bot delivered apart from the conversation', () => {
        const [item] = history({
          id: 1,
          role: 'user',
          content: delivered,
          display_kind: 'internal_notification'
        }).items
        expect(item).toEqual({
          kind: 'delivery',
          id: '1',
          text: 'Margins are up.\n\n- Costs flat',
          from: { name: 'Agro Ops CFO', profile: 'agro-ops-cfo' }
        })
      })

      it('should show a copied notice as the copy that kept its kind says', () => {
        const copy = (id: number, kind: string | null): SessionMessage =>
          ({
            id,
            role: 'user',
            content: 'Switched model',
            message_uid: 'uid-2',
            ...(kind ? { display_kind: kind } : {})
          }) as SessionMessage
        expect(history(copy(1, null), copy(2, 'model_switch')).items).toEqual([
          { kind: 'notice', id: '2', text: 'Switched model' }
        ])
      })

      it('should show a message once when compaction archived two copies of it', () => {
        const copy = (id: number): SessionMessage =>
          ({ id, role: 'assistant', content: 'Noted.', message_uid: 'uid-1' }) as SessionMessage
        const transcript = history(copy(1), { id: 2, role: 'user', content: 'Thanks' }, copy(3))
        expect(transcript.items.map((item) => [item.kind, item.id])).toEqual([
          ['bot', '1'],
          ['user', '2']
        ])
      })

      it("should name Talyx where a message has the engine's handle for it", () => {
        const { items } = history(
          {
            id: 1,
            role: 'user',
            content: 'Message from 🤖 CFO (@acme-cfo): @acme the books are shut.'
          },
          { id: 2, role: 'assistant', content: '@acme got it; mail ops@acme.com, not @acme-cfo.' },
          { id: 3, role: 'user', content: 'Thanks' }
        )
        const shown = withManagerName(items, { handle: 'acme', name: 'Talyx' })
        expect(shown.map((item) => ('text' in item ? item.text : ''))).toEqual([
          '@Talyx the books are shut.',
          '@Talyx got it; mail ops@acme.com, not @acme-cfo.',
          'Thanks'
        ])
        // A message without the handle is the same item; before the engine reports it, all are.
        expect(shown[2]).toBe(items[2])
        expect(withManagerName(items, { handle: null, name: 'Talyx' })).toBe(items)
      })
    })

    it("should read a delivery from Talyx's handle as Talyx's own profile", () => {
      expect(senderProfile('acme', 'acme')).toBe('default')
      expect(senderProfile('agro-ops-cfo', 'acme')).toBe('agro-ops-cfo')
      // Before the engine reports its handle, a sender stays as written.
      expect(senderProfile('acme', null)).toBe('acme')
    })

    it('should show engine notices as one quiet line', () => {
      const transcript = history(
        {
          id: 1,
          role: 'user',
          content: '[IMPORTANT: Delegated task finished]\nlong output',
          display_kind: 'async_delegation_complete',
          display_metadata: { display_text: 'Delegated task finished' }
        } as SessionMessage,
        {
          id: 2,
          role: 'user',
          content: 'Switched model\nmore',
          display_kind: 'model_switch'
        }
      )
      expect(transcript.items).toEqual([
        { kind: 'notice', id: '1', text: 'Delegated task finished' },
        { kind: 'notice', id: '2', text: 'Switched model' }
      ])
    })

    it('should show nothing for the notice that a background command finished, but end the turn', () => {
      const transcript = history({
        id: 1,
        role: 'user',
        content: '[IMPORTANT: Background process proc_1 completed]\nlong output',
        display_kind: 'process_complete',
        display_metadata: { display_text: 'Background Process Finished: /usr/bin/python3' }
      } as SessionMessage)
      expect(transcript.items).toEqual([{ kind: 'wake', id: '1' }])
    })

    it('should read a background command notice the engine stored without its kind the same way', () => {
      const notice = '[IMPORTANT: Background process proc_1 exited (exit code 1).\nCommand: python3'
      const transcript = history(
        {
          id: 1,
          role: 'user',
          content: notice,
          display_kind: 'process_complete'
        } as SessionMessage,
        { id: 2, role: 'user', content: notice },
        { id: 3, role: 'user', content: '[IMPORTANT: Background process proc_2 completed]' }
      )
      expect(transcript.items.map((item) => item.kind)).toEqual(['wake', 'wake', 'wake'])
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

    describe('stamped turns (engine 0.22.7)', () => {
      const TURN = 'turn-1'
      const start = (seq: number, turnId = TURN): GatewayEvent =>
        event('message.start', { turn_id: turnId }, seq)
      const delta = (text: string, offset: number, seq: number, turnId = TURN): GatewayEvent =>
        event('message.delta', { text, turn_id: turnId, segment: 0, offset }, seq)
      const streamed = (): Transcript =>
        replay(empty(), start(1), delta('Hel', 0, 2), delta('lo', 3, 3))

      it('should add no text when a reconnect replays the turn under new seqs', () => {
        const transcript = replay(streamed(), start(4), delta('Hel', 0, 5), delta('lo', 3, 6))
        expect(transcript.items).toHaveLength(1)
        expect(transcript.items[0]).toMatchObject({ kind: 'bot', text: 'Hello', streaming: true })
      })

      it('should replace the segment a superseded attempt streams again', () => {
        const transcript = applyEvent(streamed(), delta('Hello there', 0, 4))
        expect(transcript.items).toHaveLength(1)
        expect(transcript.items[0]).toMatchObject({ text: 'Hello there' })
      })

      it('should keep only the unseen tail of an overlapping chunk', () => {
        const transcript = applyEvent(streamed(), delta('lo!', 3, 4))
        expect(transcript.items[0]).toMatchObject({ text: 'Hello!' })
      })

      it('should stream the next turn as a new reply', () => {
        const transcript = replay(
          streamed(),
          event('message.complete', { text: 'Hello' }, 4),
          start(5, 'turn-2'),
          delta('Again', 0, 6, 'turn-2')
        )
        expect(transcript.items.map((item) => ('text' in item ? item.text : ''))).toEqual([
          'Hello',
          'Again'
        ])
      })

      it('should append every unstamped delta with a new seq, as older engines send them', () => {
        const transcript = replay(
          empty(),
          event('message.start', {}, 1),
          event('message.delta', { text: 'Hi' }, 2),
          event('message.delta', { text: 'Hi' }, 3)
        )
        expect(transcript.items[0]).toMatchObject({ text: 'HiHi' })
      })
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
          target: null,
          showUi: null
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

    it('should accept events from a new replay epoch', () => {
      const transcript = { ...empty(), lastSeq: 50, epoch: 'old' }
      const next = applyEvent(transcript, {
        ...event('message.start', {}, 3),
        replay_epoch: 'new'
      } as GatewayEvent)
      expect(next).toMatchObject({ lastSeq: 3, epoch: 'new', running: true })
    })

    it('should follow the running flag from session info', () => {
      expect(applyEvent(empty(), event('session.info', { running: true }, 1)).running).toBe(true)
    })
  })

  describe('turns that end early', () => {
    const asked = (): Transcript => history({ id: 1, role: 'user', content: 'Summarise Q3' })
    const NO_CREDENTIALS = 'No usable credentials found for provider acme'

    it("should keep a failed turn with the engine's account of it as an error bubble", () => {
      // The text is the engine's account; `error` may be only a code.
      const failed = replay(
        asked(),
        event('message.start', {}, 1),
        event('message.complete', { status: 'error', text: NO_CREDENTIALS, error: 'auth' }, 2)
      )
      expect(failed.items).toEqual([
        { kind: 'user', id: '1', text: 'Summarise Q3', images: [] },
        {
          kind: 'bot',
          id: 'live-1',
          text: '',
          streaming: false,
          error: NO_CREDENTIALS,
          stopped: false,
          sender: null
        }
      ])
      expect(failed.running).toBe(false)
    })

    it('should keep the text a failed turn wrote before it failed', () => {
      const failed = replay(
        asked(),
        event('message.delta', { text: 'Margins are' }, 1),
        event(
          'message.complete',
          { status: 'error', text: 'Margins are', error: 'Stream cut', partial: true },
          2
        )
      )
      expect(failed.items.at(-1)).toMatchObject({ text: 'Margins are', error: 'Stream cut' })
    })

    it('should name the error when a failed turn has no account of it', () => {
      const failed = replay(
        asked(),
        event('message.complete', { status: 'error', error: NO_CREDENTIALS }, 1)
      )
      expect(failed.items.at(-1)).toMatchObject({ text: '', error: NO_CREDENTIALS })
    })

    it('should show a failed turn the engine stored as an error bubble', () => {
      const transcript = history(
        { id: 1, role: 'user', content: 'Summarise Q3' },
        {
          id: 2,
          role: 'assistant',
          content: 'Your request was not processed.',
          display_kind: 'failed_turn',
          display_metadata: { error: 'HTTP 429: Rate limit exceeded' }
        },
        {
          id: 3,
          role: 'assistant',
          content: 'Your request was not processed.',
          display_kind: 'failed_turn'
        }
      )
      expect(transcript.items.slice(1)).toMatchObject([
        { kind: 'bot', text: '', error: 'HTTP 429: Rate limit exceeded' },
        { kind: 'bot', text: '', error: 'Your request was not processed.' }
      ])
    })

    it('should mark a stopped turn and keep its partial reply', () => {
      const stopped = replay(
        asked(),
        event('message.delta', { text: 'Margins are' }, 1),
        event('message.complete', { status: 'interrupted', text: 'Margins are' }, 2)
      )
      expect(stopped.items.at(-1)).toMatchObject({
        text: 'Margins are',
        streaming: false,
        error: null,
        stopped: true
      })
    })

    it('should mark a stopped reply read back from history', () => {
      const transcript = history(
        { id: 1, role: 'user', content: 'Summarise Q3' },
        {
          id: 2,
          role: 'assistant',
          content: 'Margins are',
          display_metadata: { interrupted: true }
        },
        { id: 3, role: 'assistant', content: 'Done', display_metadata: '{"interrupted":false}' }
      )
      expect(transcript.items.slice(1)).toMatchObject([
        { text: 'Margins are', stopped: true },
        { text: 'Done', stopped: false }
      ])
    })

    describe('provider waits', () => {
      // The engine's notice has an em dash, built from its code point since this repo never
      // spells one.
      const WAIT = `⏳ waiting on provider ${String.fromCharCode(0x2014)} retrying in 600s (attempt 1/3)`
      const waiting = (): Transcript =>
        replay(asked(), event('message.start', {}, 1), event('thinking.delta', { text: WAIT }, 2))

      it('should show the wait notice while the engine waits on a provider', () => {
        expect(waiting().wait).toBe('waiting on provider, retrying in 600s (attempt 1/3)')
      })

      it('should not show the thinking phrases that are not waits', () => {
        const thinking = replay(asked(), event('thinking.delta', { text: 'pondering…' }, 1))
        expect(thinking.wait).toBeNull()
        expect(replay(waiting(), event('thinking.delta', { text: 'pondering…' }, 3)).wait).toBe(
          'waiting on provider, retrying in 600s (attempt 1/3)'
        )
      })

      it.each([
        ['the reply streams on', event('message.delta', { text: 'Margins' }, 3)],
        ['a tool starts', event('tool.start', { tool_id: 't1', name: 'search' }, 3)],
        ['the turn ends', event('message.complete', { status: 'error', error: 'Rate limited' }, 3)],
        ['the engine clears it', event('thinking.delta', { text: '' }, 3)]
      ])('should clear the wait notice when %s', (_when, next) => {
        expect(replay(waiting(), next).wait).toBeNull()
      })

      describe('the time left before the retry', () => {
        const left = (waitedMs: number): string =>
          waitLeft(waiting().wait!, waitedMs, (seconds) => `retrying in ${seconds} s`)

        it.each([
          [0, 'waiting on provider, retrying in 600 s (attempt 1/3)'],
          [61_500, 'waiting on provider, retrying in 539 s (attempt 1/3)'],
          [600_000, 'waiting on provider, retrying in 0 s (attempt 1/3)'],
          [900_000, 'waiting on provider, retrying in 0 s (attempt 1/3)']
        ])('should count down from the time the engine named, %i ms in', (waitedMs, shown) => {
          expect(left(waitedMs)).toBe(shown)
        })

        it('should keep a wait that names no retry time as it is', () => {
          expect(waitLeft('rate limited', 5_000, () => 'never')).toBe('rate limited')
        })
      })
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

describe('chat transcript, for any delivery of a turn sequence', () => {
  // Each frame sent again any number of times, at any later point: a replay after a redial. And
  // the engine's own re-send of a turn's start or text, with no sequence number, before the next
  // turn starts: the stream cursor alone tells it apart.
  const delivery = (clean: GatewayEvent[]): fc.Arbitrary<GatewayEvent[]> =>
    fc
      .tuple(
        fc.array(fc.tuple(fc.nat(), fc.nat()), { maxLength: 12 }),
        fc.array(fc.tuple(fc.nat(), fc.nat()), { maxLength: 6 })
      )
      .map(([replays, resends]) => {
        const delivered = [...clean]
        for (const [which, where] of replays) {
          const frame = clean[which % clean.length]
          const sentAt = delivered.indexOf(frame)
          delivered.splice(sentAt + 1 + (where % (delivered.length - sentAt)), 0, frame)
        }
        const streamed = clean.filter(
          (frame) =>
            frame.type !== 'tool.start' &&
            frame.type !== 'tool.complete' &&
            frame.type !== 'message.complete'
        )
        for (const [which, where] of resends) {
          const frame = streamed[which % streamed.length]
          const sentAt = delivered.indexOf(frame)
          const turnId = (frame.payload as { turn_id: string }).turn_id
          const nextTurn = delivered.findIndex(
            (later, index) =>
              index > sentAt &&
              later.type === 'message.start' &&
              (later.payload as { turn_id: string }).turn_id !== turnId
          )
          const end = nextTurn < 0 ? delivered.length : nextTurn
          const unsequenced: GatewayEvent = { ...frame, seq: undefined }
          delivered.splice(sentAt + 1 + (where % (end - sentAt)), 0, unsequenced)
        }
        return delivered
      })

  const withDelivery = turnFrames(SESSION).chain((clean) =>
    fc.tuple(fc.constant(clean), delivery(clean))
  )

  it('should give the same transcript for duplicated and late re-sent frames as for the clean sequence', () => {
    fc.assert(
      fc.property(withDelivery, ([clean, delivered]) => {
        expect(replay(empty(), ...delivered)).toEqual(replay(empty(), ...clean))
      })
    )
  })

  // The engine (0.22.7 on) re-sends a turn's frames under new seqs on some roads (types.ts): part of
  // a turn arrives, then the turn again from its start, renumbered, and on from there.
  const resentTurn = turnFrames(SESSION).chain((clean) =>
    fc.nat({ max: clean.length - 1 }).map((upTo) => {
      const turnStart = clean.findLastIndex(
        (frame, index) => index <= upTo && frame.type === 'message.start'
      )
      const again = [...clean.slice(turnStart, upTo + 1), ...clean.slice(upTo + 1)]
      const renumbered = again.map((frame, index) => ({ ...frame, seq: upTo + 2 + index }))
      return { clean, delivered: [...clean.slice(0, upTo + 1), ...renumbered] }
    })
  )
  // A streamed reply's id names the seq it started at, which a re-send renumbers.
  const shown = (transcript: Transcript): unknown[] =>
    transcript.items.map((item) => (item.id.startsWith(LIVE_ID) ? { ...item, id: LIVE_ID } : item))

  it('should give the same transcript when the engine re-sends a turn under new seqs', () => {
    fc.assert(
      fc.property(resentTurn, ({ clean, delivered }) => {
        expect(shown(replay(empty(), ...delivered))).toEqual(shown(replay(empty(), ...clean)))
      })
    )
  })

  it('should keep every message id unique', () => {
    fc.assert(
      fc.property(withDelivery, ([, delivered]) => {
        const ids = replay(empty(), ...delivered).items.map((item) => item.id)
        expect(new Set(ids).size).toBe(ids.length)
      })
    )
  })

  it('should answer needsRebuild the same every time and leave the event as it was', () => {
    const anyEvent = fc.record({
      type: fc.constantFrom('session.replay_gap', 'session.updated', 'message.delta', 'tool.start'),
      payload: fc.option(
        fc.record(
          { operation: fc.constantFrom('rewind', 'model', undefined) },
          { requiredKeys: [] }
        )
      ),
      session_id: fc.constant(SESSION)
    })
    fc.assert(
      fc.property(anyEvent, (raw) => {
        const frame = raw as unknown as GatewayEvent
        const copy = structuredClone(frame)
        const first = needsRebuild(frame)
        expect(first).toBe(
          raw.type === 'session.replay_gap' ||
            (raw.type === 'session.updated' && raw.payload?.operation === 'rewind')
        )
        expect(needsRebuild(frame)).toBe(first)
        expect(frame).toEqual(copy)
      })
    )
  })
})
