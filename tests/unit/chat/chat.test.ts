import { beforeEach, describe, expect, it } from 'vitest'
import { MediaGoneError, chatActions } from '../../../src/renderer/src/features/chat/chat'
import type { ChatActions } from '../../../src/renderer/src/features/chat/chat'
import { useChat } from '../../../src/renderer/src/features/chat/store'
import { handleEvent } from '../../../src/renderer/src/features/chat/events'
import { addPrompt } from '../../../src/renderer/src/features/chat/transcript'
import type { GatewayEvent } from '../../../src/renderer/src/shared/engine/shared'
import { KEPT_ENDPOINT_PROFILE, chatDouble } from './chatDouble'
import type { ChatCall, ChatDouble } from './chatDouble'
import type { ChatState } from '../../../src/renderer/src/features/chat/store'

const MANAGER = 'acme-manager'
const WORKER = 'acme-worker'

let engine: ChatDouble
let actions: ChatActions

const chat = (profile: string): ChatState => useChat.getState().chats[profile]
const methods = (): string[] => engine.calls.map((call) => call.method)
const call = (method: string): ChatCall | undefined =>
  engine.calls.find((item) => item.method === method)

beforeEach(() => {
  useChat.setState({ chats: {} })
  engine = chatDouble()
  actions = chatActions(engine.backend)
})

describe('bot chat', () => {
  describe('opening', () => {
    it("should open a bot's chat with its history", async () => {
      await actions.open(MANAGER, 'manager-chat')
      expect(chat(MANAGER)).toMatchObject({
        sessionId: 'manager-chat',
        loading: false,
        error: null,
        info: { model: '9-route-provider', provider: 'custom', reasoning: 'medium' }
      })
      expect(chat(MANAGER).transcript?.items.map((item) => item.kind)).toEqual(['user', 'bot'])
      expect(call('session.resume')?.params).toMatchObject({
        session_id: 'manager-chat',
        defer_history: true,
        omit_messages: true
      })
      expect(call('GET /api/sessions')?.params).toMatchObject({
        path: '/api/sessions/manager-chat/messages',
        limit: '120',
        order: 'latest',
        include_compacted: 'true'
      })
    })

    it('should find the chat by its title when the roster has no id', async () => {
      await actions.open(MANAGER, null)
      expect(call('session.list')?.params).toEqual({
        title: 'Bot Chat',
        limit: 200,
        include_hidden: true
      })
      expect(chat(MANAGER).sessionId).toBe('manager-chat')
    })

    it("should read a bot's newest replies as text, finding its chat by title", async () => {
      const replies = await actions.recent(MANAGER, 40)
      expect(replies.length).toBeGreaterThan(0)
      expect(replies.every((reply) => typeof reply === 'string')).toBe(true)
      expect(call('GET /api/sessions')?.params).toMatchObject({
        path: '/api/sessions/manager-chat/messages',
        limit: '40',
        order: 'latest'
      })
    })

    it('should have no replies, and create no chat, for a bot never chatted with', async () => {
      expect(await actions.recent(WORKER, 40)).toEqual([])
      expect(methods()).not.toContain('session.create')
    })

    it('should show an empty chat and create nothing for a bot never chatted with', async () => {
      await actions.open(WORKER, null)
      expect(chat(WORKER)).toMatchObject({ sessionId: null, transcript: null, loading: false })
      expect(methods()).not.toContain('session.create')
    })

    it("should keep open cards and adopt the snapshot's replay position when the chat rebuilds", async () => {
      await actions.open(MANAGER, 'manager-chat')
      const transcript = chat(MANAGER).transcript!
      useChat.getState().update(MANAGER, {
        transcript: addPrompt(
          { ...transcript, lastSeq: 40 },
          {
            kind: 'clarify',
            id: 'p1',
            questions: [],
            answers: {}
          }
        )
      })
      await actions.rebuild(MANAGER)
      expect(chat(MANAGER).transcript?.prompts.map((prompt) => prompt.id)).toEqual(['p1'])
      expect(chat(MANAGER).transcript?.lastSeq).toBe(7)
    })
  })

  describe('reloading', () => {
    it('should keep live events that arrive while the chat reloads', async () => {
      await actions.open(MANAGER, 'manager-chat')
      const reload = actions.rebuild(MANAGER)
      for (const [type, seq, payload] of [
        ['message.start', 8, {}],
        ['message.delta', 9, { text: 'Live' }]
      ] as const)
        handleEvent(actions, { type, seq, payload, session_id: 'manager-chat' } as GatewayEvent)
      await reload
      expect(chat(MANAGER).transcript?.items.at(-1)).toMatchObject({
        text: 'Live',
        streaming: true
      })
    })

    it('should stop keeping live events once a reload fails', async () => {
      await actions.open(MANAGER, 'manager-chat')
      engine.failNext('session.resume', 'Gateway restarting')
      await actions.rebuild(MANAGER)
      expect(chat(MANAGER)).toMatchObject({
        pending: null,
        error: { key: 'chat.errorLoad', detail: 'Gateway restarting' }
      })
    })

    it('should not let an older reload overwrite a newer one', async () => {
      await actions.open(MANAGER, 'manager-chat')
      const release = engine.holdNext('GET /api/sessions')
      const older = actions.rebuild(MANAGER)
      engine.chats[MANAGER].messages = [{ id: 9, role: 'user', content: 'Newer' }]
      await actions.rebuild(MANAGER)
      release()
      await older
      expect(chat(MANAGER).transcript?.items.map((item) => item.id)).toEqual(['9'])
    })
  })

  describe('a failed turn', () => {
    const UNKNOWN_PROVIDER = "Unknown provider 'acme'. Send it again if you still want me to."
    const NO_CREDENTIALS = 'No usable credentials found for provider acme'
    const visible = (): Array<Record<string, unknown>> =>
      (chat(MANAGER).transcript?.items ?? []).map((item) =>
        item.kind === 'user'
          ? { kind: item.kind, text: item.text }
          : item.kind === 'bot'
            ? { kind: item.kind, text: item.text, error: item.error }
            : { kind: item.kind }
      )
    const before = [
      { kind: 'user', text: 'Hello' },
      { kind: 'bot', text: 'Hi there', error: null }
    ]
    const failedWith = (reason: string): Array<Record<string, unknown>> => [
      { kind: 'user', text: 'Summarise Q3' },
      { kind: 'bot', text: '', error: reason }
    ]
    // The engine's frame for a turn that never reached the model: the reason is its text.
    const failSend = async (): Promise<void> => {
      await actions.send(MANAGER, { text: 'Summarise Q3', images: [] })
      handleEvent(actions, {
        type: 'message.complete',
        seq: 8,
        payload: { status: 'error', text: UNKNOWN_PROVIDER },
        session_id: 'manager-chat'
      } as GatewayEvent)
      await actions.rebuild(MANAGER)
    }

    it("should keep your message and the engine's reason after the chat reloads", async () => {
      await actions.open(MANAGER, 'manager-chat')
      await failSend()
      expect(visible()).toEqual([...before, ...failedWith(UNKNOWN_PROVIDER)])
    })

    it('should keep the failed turn in its place once later turns are stored', async () => {
      await actions.open(MANAGER, 'manager-chat')
      await failSend()
      engine.chats[MANAGER].messages.push(
        { id: 3, role: 'user', content: 'Try again' },
        { id: 4, role: 'assistant', content: 'Done' }
      )
      await actions.rebuild(MANAGER)
      await actions.open(MANAGER, 'manager-chat')
      expect(visible()).toEqual([
        ...before,
        ...failedWith(UNKNOWN_PROVIDER),
        { kind: 'user', text: 'Try again' },
        { kind: 'bot', text: 'Done', error: null }
      ])
    })

    it('should show the failed turn once when the engine stored it', async () => {
      await actions.open(MANAGER, 'manager-chat')
      engine.chats[MANAGER].messages.push(
        { id: 3, role: 'user', content: 'Summarise Q3' },
        {
          id: 4,
          role: 'assistant',
          content: 'Your request was not processed.',
          display_kind: 'failed_turn',
          display_metadata: { error: UNKNOWN_PROVIDER }
        }
      )
      await failSend()
      expect(visible()).toEqual([...before, ...failedWith(UNKNOWN_PROVIDER)])
    })

    it('should show it once when the engine stored it after the tools it ran', async () => {
      await actions.open(MANAGER, 'manager-chat')
      engine.chats[MANAGER].messages.push(
        { id: 3, role: 'user', content: 'Summarise Q3' },
        { id: 4, role: 'assistant', content: 'Looking it up' },
        {
          id: 5,
          role: 'assistant',
          content: 'Your request was not processed.',
          display_kind: 'failed_turn',
          display_metadata: { error: UNKNOWN_PROVIDER }
        }
      )
      await failSend()
      expect(visible()).toEqual([
        ...before,
        { kind: 'user', text: 'Summarise Q3' },
        { kind: 'bot', text: 'Looking it up', error: null },
        { kind: 'bot', text: '', error: UNKNOWN_PROVIDER }
      ])
    })

    it('should keep the failed send apart from the same words sent again', async () => {
      await actions.open(MANAGER, 'manager-chat')
      await failSend()
      engine.chats[MANAGER].messages.push(
        { id: 3, role: 'user', content: 'Summarise Q3' },
        { id: 4, role: 'assistant', content: 'Margins are up.' }
      )
      await actions.rebuild(MANAGER)
      expect(visible()).toEqual([
        ...before,
        ...failedWith(UNKNOWN_PROVIDER),
        { kind: 'user', text: 'Summarise Q3' },
        { kind: 'bot', text: 'Margins are up.', error: null }
      ])
    })

    it('should keep your message when the turn failed after its tools', async () => {
      await actions.open(MANAGER, 'manager-chat')
      await actions.send(MANAGER, { text: 'Summarise Q3', images: [] })
      for (const [type, seq, payload] of [
        ['message.start', 8, {}],
        ['message.delta', 9, { text: 'Looking it up' }],
        ['tool.start', 10, { tool_id: 't1', name: 'search_files' }],
        ['tool.complete', 11, { tool_id: 't1' }],
        ['message.complete', 12, { status: 'error', text: UNKNOWN_PROVIDER }]
      ] as const)
        handleEvent(actions, { type, seq, payload, session_id: 'manager-chat' } as GatewayEvent)
      await actions.rebuild(MANAGER)
      expect(visible()).toEqual([...before, ...failedWith(UNKNOWN_PROVIDER)])
    })

    it('should keep a failed turn no message of yours started where it was', async () => {
      engine.chats[MANAGER].messages.push({
        id: 3,
        role: 'user',
        content: 'Message from 🤖 CFO (@cfo): numbers'
      })
      await actions.open(MANAGER, 'manager-chat')
      for (const [type, seq, payload] of [
        ['message.start', 8, {}],
        ['message.complete', 9, { status: 'error', text: UNKNOWN_PROVIDER }]
      ] as const)
        handleEvent(actions, { type, seq, payload, session_id: 'manager-chat' } as GatewayEvent)
      await actions.rebuild(MANAGER)
      expect(visible()).toEqual([
        ...before,
        { kind: 'bot', text: 'numbers', error: null },
        { kind: 'bot', text: '', error: UNKNOWN_PROVIDER }
      ])
    })

    it('should keep a delivered turn that failed right after your failed send apart', async () => {
      await actions.open(MANAGER, 'manager-chat')
      await failSend()
      engine.chats[MANAGER].messages.push({
        id: 3,
        role: 'user',
        content: 'Message from 🤖 CFO (@cfo): numbers'
      })
      // The delivery shows only once the turn it started reloads the history.
      for (const [type, seq, payload] of [
        ['message.start', 20, {}],
        ['message.complete', 21, { status: 'error', text: NO_CREDENTIALS }]
      ] as const)
        handleEvent(actions, { type, seq, payload, session_id: 'manager-chat' } as GatewayEvent)
      await actions.rebuild(MANAGER)
      expect(visible()).toEqual([
        ...before,
        ...failedWith(UNKNOWN_PROVIDER),
        { kind: 'bot', text: 'numbers', error: null },
        { kind: 'bot', text: '', error: NO_CREDENTIALS }
      ])
    })

    describe('that the engine still holds', () => {
      // A failed turn the engine kept for a client that missed its frame: resume carries it.
      const held = { user: 'Summarise Q3', assistant: '', error: NO_CREDENTIALS, status: 'error' }

      it('should show it once when the chat opens', async () => {
        engine.chats[MANAGER].inflight = held
        await actions.open(MANAGER, 'manager-chat')
        await actions.open(MANAGER, 'manager-chat')
        expect(visible()).toEqual([...before, ...failedWith(NO_CREDENTIALS)])
      })

      it('should not repeat your message when the engine stored it', async () => {
        engine.chats[MANAGER].messages.push({ id: 3, role: 'user', content: 'Summarise Q3' })
        engine.chats[MANAGER].inflight = held
        await actions.open(MANAGER, 'manager-chat')
        expect(visible()).toEqual([...before, ...failedWith(NO_CREDENTIALS)])
      })

      it('should show it once when the engine later stores the failure', async () => {
        engine.chats[MANAGER].messages.push({ id: 3, role: 'user', content: 'Summarise Q3' })
        engine.chats[MANAGER].inflight = held
        await actions.open(MANAGER, 'manager-chat')
        engine.chats[MANAGER].messages.push({
          id: 4,
          role: 'assistant',
          content: 'Your request was not processed.',
          display_kind: 'failed_turn',
          display_metadata: { error: NO_CREDENTIALS }
        })
        await actions.rebuild(MANAGER)
        await actions.rebuild(MANAGER)
        expect(visible()).toEqual([...before, ...failedWith(NO_CREDENTIALS)])
      })

      it('should show the failed send once after the reload that follows it', async () => {
        await actions.open(MANAGER, 'manager-chat')
        engine.chats[MANAGER].inflight = { ...held, error: UNKNOWN_PROVIDER }
        await failSend()
        expect(visible()).toEqual([...before, ...failedWith(UNKNOWN_PROVIDER)])
      })
    })
  })

  describe('sending', () => {
    it('should create one Bot Chat when two sends race', async () => {
      await actions.open(WORKER, null)
      await Promise.all([
        actions.send(WORKER, { text: 'One', images: [] }),
        actions.send(WORKER, { text: 'Two', images: [] })
      ])
      expect(methods().filter((method) => method === 'session.create')).toHaveLength(1)
      expect(
        engine.calls
          .filter((item) => item.method === 'prompt.submit')
          .map((item) => item.params.session_id)
      ).toEqual(['created-1', 'created-1'])
    })

    it('should give a failed send back to the composer', async () => {
      await actions.open(MANAGER, 'manager-chat')
      engine.failNext('prompt.submit', 'Gateway refused the prompt')
      expect(await actions.send(MANAGER, { text: 'Hi', images: [] })).toBe(false)
      expect(chat(MANAGER).transcript?.items.map((item) => item.kind)).toEqual(['user', 'bot'])
      expect(await actions.send(MANAGER, { text: 'Hi', images: [] })).toBe(true)
    })

    it('should create one Bot Chat on the first send and submit the text', async () => {
      await actions.open(WORKER, null)
      await actions.send(WORKER, { text: '  Hi worker  ', images: [] })
      expect(methods().filter((method) => method === 'session.create')).toHaveLength(1)
      expect(call('session.create')?.params).toEqual({
        title: 'Bot Chat',
        hidden: true,
        follow_profile_config: true
      })
      expect(call('session.title')?.params).toEqual({ session_id: 'created-1', title: 'Bot Chat' })
      expect(call('prompt.submit')?.params).toEqual({ session_id: 'created-1', text: 'Hi worker' })
      expect(chat(WORKER).sessionId).toBe('created-1')
      expect(chat(WORKER).transcript?.items.at(-1)).toMatchObject({
        kind: 'user',
        text: 'Hi worker'
      })
    })

    it('should ask the engine to queue a message sent to wait behind a busy turn', async () => {
      await actions.open(MANAGER, 'manager-chat')
      await actions.send(MANAGER, { text: 'Next task', images: [], whenBusy: 'queue' })
      expect(call('prompt.submit')?.params).toEqual({
        session_id: 'manager-chat',
        text: 'Next task',
        queued: true
      })
    })

    it('should adopt the existing chat when the title is already in use', async () => {
      engine.chats[WORKER] = { sessionId: 'winner', messages: [] }
      await actions.open(WORKER, 'missing-from-roster')
      useChat.getState().update(WORKER, { sessionId: null, transcript: null })
      engine.failNext('session.title', "Title 'Bot Chat' is already in use")
      await actions.send(WORKER, { text: 'Hi', images: [] })
      expect(call('prompt.submit')?.params).toMatchObject({ session_id: 'winner' })
    })

    it('should not send an empty message', async () => {
      await actions.open(MANAGER, 'manager-chat')
      await actions.send(MANAGER, { text: '   ', images: [] })
      expect(methods()).not.toContain('prompt.submit')
    })

    it('should send attached images with the prompt', async () => {
      await actions.open(MANAGER, 'manager-chat')
      const image = await actions.uploadImage(MANAGER, {
        dataUrl: 'data:image/png;base64,AAAA',
        name: 'shot.png'
      })
      expect(call('POST /api/chat/image-upload')?.params).toMatchObject({
        data_url: 'data:image/png;base64,AAAA',
        filename: 'shot.png'
      })
      await actions.send(MANAGER, { text: '', images: [image] })
      expect(call('prompt.submit')?.params).toEqual({
        session_id: 'manager-chat',
        text: '',
        attachments: [{ path: '/images/pasted.png', mime: 'image/png' }]
      })
    })

    it.each([
      ['stop', 'session.interrupt', 'chat.errorStop'],
      ['model change', 'config.set', 'chat.errorModel']
    ] as const)('should name a failed %s on the chat', async (action, method, key) => {
      await actions.open(MANAGER, 'manager-chat')
      engine.failNext(method, 'Gateway busy')
      if (action === 'stop') await actions.interrupt(MANAGER)
      else await actions.setModel(MANAGER, { model: 'm', provider: 'p' })
      expect(chat(MANAGER).error).toEqual({ key, detail: 'Gateway busy' })
    })

    it("should show a failed send as the chat's error", async () => {
      await actions.open(MANAGER, 'manager-chat')
      engine.failNext('prompt.submit', 'Gateway refused the prompt')
      await actions.send(MANAGER, { text: 'Hi', images: [] })
      expect(chat(MANAGER).error).toEqual({
        key: 'chat.errorSend',
        detail: 'Gateway refused the prompt'
      })
    })
  })

  describe('a message sent while the bot answers', () => {
    let seq = 10
    const emit = (type: string, payload: Record<string, unknown> = {}): void => {
      seq += 1
      handleEvent(actions, { type, seq, payload, session_id: 'manager-chat' } as GatewayEvent)
    }
    const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
    const submitted = (): unknown[] =>
      engine.calls.filter((item) => item.method === 'prompt.submit').map((item) => item.params.text)
    const draft = (text: string): { text: string; images: [] } => ({ text, images: [] })

    beforeEach(async () => {
      await actions.open(MANAGER, 'manager-chat')
      emit('message.start', { turn_id: 't1' })
    })

    it('should go at once when the bot is idle', async () => {
      emit('message.complete', { text: 'Done', status: 'complete' })
      expect(await actions.queue(MANAGER, draft('Now'))).toBe(true)
      expect(submitted()).toEqual(['Now'])
      expect(chat(MANAGER).waiting).toEqual([])
    })

    it('should wait for the running answer to end, then go, leaving that answer whole', async () => {
      await actions.queue(MANAGER, draft('Next'))
      expect(submitted()).toEqual([])
      expect(chat(MANAGER).waiting.map((message) => message.draft.text)).toEqual(['Next'])
      emit('message.delta', { text: 'Part one, ' })
      emit('message.delta', { text: 'part two' })
      emit('message.complete', { text: 'Part one, part two', status: 'complete' })
      await settled()
      expect(submitted()).toEqual(['Next'])
      expect(chat(MANAGER).waiting).toEqual([])
    })

    it('should send several waiting messages one per answer, oldest first', async () => {
      await actions.queue(MANAGER, draft('First'))
      await actions.queue(MANAGER, draft('Second'))
      emit('message.complete', { text: 'A', status: 'complete' })
      await settled()
      expect(submitted()).toEqual(['First'])
      // Before the engine starts the answer to First, Second still waits.
      await actions.queue(MANAGER, draft('Third'))
      expect(submitted()).toEqual(['First'])
      emit('message.start', { turn_id: 't2' })
      emit('message.complete', { text: 'B', status: 'complete' })
      await settled()
      expect(submitted()).toEqual(['First', 'Second'])
      expect(chat(MANAGER).waiting.map((message) => message.draft.text)).toEqual(['Third'])
    })

    it('should send the next waiting message when the answer is stopped', async () => {
      await actions.queue(MANAGER, draft('Instead'))
      emit('message.complete', { text: '', status: 'interrupted' })
      await settled()
      expect(submitted()).toEqual(['Instead'])
    })

    it('should never send a message taken back', async () => {
      await actions.queue(MANAGER, draft('Never mind'))
      actions.unqueue(MANAGER, chat(MANAGER).waiting[0].id)
      emit('message.complete', { text: 'A', status: 'complete' })
      await settled()
      expect(submitted()).toEqual([])
    })

    it('should keep a waiting message first in line when its send fails, and say why', async () => {
      await actions.queue(MANAGER, draft('Next'))
      engine.failNext('prompt.submit', 'Gateway refused the prompt')
      emit('message.complete', { text: 'A', status: 'complete' })
      await settled()
      expect(chat(MANAGER).waiting.map((message) => message.draft.text)).toEqual(['Next'])
      expect(chat(MANAGER).error).toMatchObject({ key: 'chat.errorSend' })
      // The next message retries it, in order.
      await actions.queue(MANAGER, draft('After'))
      expect(submitted()).toEqual(['Next', 'Next'])
    })
  })

  describe('during a turn', () => {
    it('should answer every clarify question in order', async () => {
      await actions.open(MANAGER, 'manager-chat')
      useChat.getState().update(MANAGER, {
        transcript: addPrompt(chat(MANAGER).transcript!, {
          kind: 'clarify',
          id: 'p1',
          questions: [
            { qid: 'q1', question: 'Quarter?', choices: ['Q3'], multiSelect: false },
            { qid: 'q2', question: 'Regions?', choices: ['a', 'b'], multiSelect: true }
          ],
          answers: {}
        })
      })
      await actions.answerClarify(MANAGER, 'p1', { q1: 'Q3', q2: ['a', 'b'] })
      expect(
        engine.calls.filter((item) => item.method === 'clarify.lock').map((item) => item.params)
      ).toEqual([
        { request_id: 'p1', question_id: 'q1', answer: 'Q3' },
        { request_id: 'p1', question_id: 'q2', answer: '["a","b"]' }
      ])
      expect(chat(MANAGER).transcript?.prompts).toEqual([])
    })

    it('should answer an approval and close its card', async () => {
      await actions.open(MANAGER, 'manager-chat')
      const choices: string[] = []
      useChat.getState().update(MANAGER, {
        transcript: addPrompt(chat(MANAGER).transcript!, {
          kind: 'approval',
          id: 'a1',
          command: 'rm -rf build',
          description: '',
          choices: ['once', 'session', 'always', 'deny'],
          respond: (choice) => choices.push(choice)
        })
      })
      actions.answerApproval(MANAGER, 'a1', 'session')
      expect(choices).toEqual(['session'])
      expect(chat(MANAGER).transcript?.prompts).toEqual([])
    })

    it('should stop the running turn', async () => {
      await actions.open(MANAGER, 'manager-chat')
      await actions.interrupt(MANAGER)
      expect(call('session.interrupt')?.params).toEqual({ session_id: 'manager-chat' })
    })

    it('should not show a model or reasoning level the chat cannot use before it exists', async () => {
      await actions.open(WORKER, null)
      await actions.setModel(WORKER, { model: 'cfo-model', provider: 'custom' })
      await actions.setReasoning(WORKER, 'high')
      expect(chat(WORKER).info).toEqual({ model: null, provider: null, reasoning: null })
      expect(methods()).not.toContain('config.set')
    })

    it('should set the model and reasoning on the open session', async () => {
      await actions.open(MANAGER, 'manager-chat')
      await actions.setModel(MANAGER, { model: 'cfo-model', provider: 'custom' })
      await actions.setReasoning(MANAGER, 'high')
      expect(chat(MANAGER).info).toEqual({
        model: 'cfo-model',
        provider: 'custom',
        reasoning: 'high'
      })
      expect(
        engine.calls.filter((item) => item.method === 'config.set').map((item) => item.params)
      ).toEqual([
        { session_id: 'manager-chat', key: 'model', value: 'cfo-model --provider custom' },
        { session_id: 'manager-chat', key: 'reasoning', value: 'high' }
      ])
    })
  })

  describe('models', () => {
    it("should list the models the profile's providers offer, a router only its saved ones", async () => {
      expect(await actions.models(MANAGER)).toEqual([
        expect.objectContaining({ slug: 'custom', models: ['9-route-provider'] }),
        { slug: 'anthropic', name: 'Anthropic', models: ['claude-haiku'] }
      ])
      expect(call('GET /api/model/options')?.params).toMatchObject({ explicit_only: '1' })
      expect(call('GET /api/providers/custom-endpoints')?.profile).toBe(MANAGER)
      expect(engine.calls.at(-1)?.profile).toBe(MANAGER)
    })

    it('should list a kept custom endpoint once, standing for the bare one on the same URL', async () => {
      expect(await actions.models(KEPT_ENDPOINT_PROFILE)).toEqual([
        expect.objectContaining({
          slug: 'endpoint-router',
          aliases: ['custom'],
          models: ['9-route-provider']
        })
      ])
    })

    it('should load the models once for every menu until they are forgotten', async () => {
      const loads = (): number => methods().filter((m) => m === 'GET /api/model/options').length
      await actions.models(MANAGER)
      await actions.models(MANAGER)
      expect(loads()).toBe(1)
      actions.forgetModels()
      await actions.models(MANAGER)
      expect(loads()).toBe(2)
    })

    it('should try again after a failed load', async () => {
      engine.failNext('GET /api/model/options', 'Engine offline')
      await expect(actions.models(MANAGER)).rejects.toThrow()
      expect(await actions.models(MANAGER)).toHaveLength(2)
    })

    it('should list every model offered when the saved lists cannot be read', async () => {
      engine.failNext('GET /api/providers/custom-endpoints', 'Not Found')

      expect((await actions.models(MANAGER))[0].models).toEqual([
        '9-route-provider',
        'behind/the-router'
      ])
    })
  })

  describe('media', () => {
    it('should transcribe a recording and load an image', async () => {
      expect(
        await actions.transcribe(MANAGER, {
          dataUrl: 'data:audio/webm;base64,AA',
          mime: 'audio/webm'
        })
      ).toBe('dictated words')
      expect(call('POST /api/audio/transcribe')?.params).toMatchObject({ mime_type: 'audio/webm' })
      expect(await actions.mediaUrl(MANAGER, '/images/a b.png')).toBe('data:image/png;base64,AAAA')
      expect(call('GET /api/media')?.params).toMatchObject({ path: '/api/media' })
      expect(engine.calls.at(-1)?.profile).toBe(MANAGER)
    })

    it('should report an image the engine no longer has as gone', async () => {
      engine.goneMedia.add('/images/gone.png')
      await expect(actions.mediaUrl(MANAGER, '/images/gone.png')).rejects.toBeInstanceOf(
        MediaGoneError
      )
    })
  })
})
