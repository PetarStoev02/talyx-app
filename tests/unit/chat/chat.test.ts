import { beforeEach, describe, expect, it } from 'vitest'
import { chatActions } from '../../../src/renderer/src/features/chat/chat'
import type { ChatActions } from '../../../src/renderer/src/features/chat/chat'
import { useChat } from '../../../src/renderer/src/features/chat/store'
import { handleEvent } from '../../../src/renderer/src/features/chat/events'
import { addPrompt } from '../../../src/renderer/src/features/chat/transcript'
import type { GatewayEvent } from '../../../src/renderer/src/shared/engine/shared'
import { chatDouble } from './chatDouble'
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
        info: { model: 'team-manager', provider: 'custom', reasoning: 'medium' }
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
      expect(chat(MANAGER)).toMatchObject({ pending: null, error: 'Gateway restarting' })
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

    it("should show a failed send as the chat's error", async () => {
      await actions.open(MANAGER, 'manager-chat')
      engine.failNext('prompt.submit', 'Gateway refused the prompt')
      await actions.send(MANAGER, { text: 'Hi', images: [] })
      expect(chat(MANAGER).error).toBe('Gateway refused the prompt')
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
    it("should list the models the profile's providers offer", async () => {
      expect(await actions.models(MANAGER)).toEqual([
        { slug: 'custom', name: 'Router', models: ['team-manager'] }
      ])
      expect(call('GET /api/model/options')?.params).toMatchObject({ explicit_only: '1' })
      expect(engine.calls.at(-1)?.profile).toBe(MANAGER)
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
  })
})
