import { beforeEach, describe, expect, it } from 'vitest'
import { chatActions } from '../../../src/renderer/src/features/chat/chat'
import type { ChatActions } from '../../../src/renderer/src/features/chat/chat'
import { handleEvent, handlePrompt } from '../../../src/renderer/src/features/chat/events'
import { useChat } from '../../../src/renderer/src/features/chat/store'
import type { ChatState } from '../../../src/renderer/src/features/chat/store'
import type { GatewayEvent, ServerRequest } from '../../../src/renderer/src/shared/engine/shared'
import { chatDouble } from './chatDouble'
import type { ChatDouble } from './chatDouble'

const MANAGER = 'acme-manager'
const WORKER = 'acme-worker'

let engine: ChatDouble
let actions: ChatActions

const chat = (profile: string): ChatState => useChat.getState().chats[profile]

const event = (
  sessionId: string,
  type: string,
  seq: number,
  payload: Record<string, unknown> = {}
): GatewayEvent => ({ type, payload, session_id: sessionId, seq }) as GatewayEvent

const clarifyRequest = (sessionId: string): ServerRequest => ({
  id: 'p1',
  method: 'clarify',
  params: {
    session_id: sessionId,
    questions: [{ qid: 'q1', question: 'Quarter?', choices: ['Q3'], multi_select: false }],
    answers: {}
  },
  respond: () => undefined,
  fail: () => undefined
})

beforeEach(async () => {
  useChat.setState({ chats: {} })
  engine = chatDouble({
    [MANAGER]: { sessionId: 'manager-chat', messages: [] },
    [WORKER]: { sessionId: 'worker-chat', messages: [] }
  })
  actions = chatActions(engine.backend)
  await actions.open(MANAGER, 'manager-chat')
  await actions.open(WORKER, 'worker-chat')
})

describe('chat events', () => {
  it('should stream into the chat that owns the session, even when another bot is selected', () => {
    expect(handleEvent(actions, event('worker-chat', 'message.start', 10))).toEqual({
      profile: WORKER,
      completed: false,
      activity: 'working'
    })
    handleEvent(actions, event('worker-chat', 'message.delta', 11, { text: 'Brief ready' }))
    expect(handleEvent(actions, event('worker-chat', 'message.complete', 12))).toEqual({
      profile: WORKER,
      completed: true,
      activity: 'idle'
    })
    expect(chat(WORKER).transcript?.items.at(-1)).toMatchObject({ text: 'Brief ready' })
    expect(chat(MANAGER).transcript?.items).toEqual([])
  })

  it('should not report a replayed reply as new', () => {
    handleEvent(actions, event('worker-chat', 'message.complete', 12, { text: 'Done' }))
    expect(handleEvent(actions, event('worker-chat', 'message.complete', 12))?.completed).toBe(
      false
    )
  })

  it('should report waiting while a card is open and idle once it settles', () => {
    expect(handlePrompt(clarifyRequest('manager-chat'))).toEqual({
      profile: MANAGER,
      completed: false,
      activity: 'waiting'
    })
    expect(chat(MANAGER).transcript?.prompts[0]).toMatchObject({
      kind: 'clarify',
      id: 'p1',
      questions: [{ qid: 'q1', question: 'Quarter?', choices: ['Q3'], multiSelect: false }]
    })
    expect(
      handleEvent(actions, event('manager-chat', 'clarify.settled', 20, { prompt_id: 'p1' }))
        ?.activity
    ).toBe('idle')
  })

  it('should keep a card the snapshot delivers while the chat is still opening', async () => {
    useChat.setState({ chats: {} })
    const opening = actions.open(MANAGER, 'manager-chat')
    handlePrompt(clarifyRequest('manager-chat'))
    await opening
    expect(chat(MANAGER).transcript?.prompts.map((prompt) => prompt.id)).toEqual(['p1'])
  })

  it('should answer an approval card through its request', () => {
    const answers: unknown[] = []
    handlePrompt({
      ...clarifyRequest('manager-chat'),
      id: 'a1',
      method: 'approval',
      params: { session_id: 'manager-chat', command: 'rm -rf build', choices: ['once', 'deny'] },
      respond: (result) => answers.push(result)
    })
    const prompt = chat(MANAGER).transcript?.prompts[0]
    expect(prompt).toMatchObject({ kind: 'approval', command: 'rm -rf build' })
    if (prompt?.kind === 'approval') prompt.respond('once')
    expect(answers).toEqual([{ choice: 'once' }])
  })

  it('should follow model changes made on another client', () => {
    handleEvent(
      actions,
      event('manager-chat', 'session.info', 40, { model: 'cfo-model', provider: 'custom' })
    )
    expect(chat(MANAGER).info).toMatchObject({ model: 'cfo-model', provider: 'custom' })
  })

  it('should rebuild the chat on a replay gap', async () => {
    const before = engine.calls.length
    handleEvent(actions, event('manager-chat', 'session.replay_gap', 30))
    await Promise.resolve()
    expect(engine.calls.slice(before).map((call) => call.method)).toContain('session.resume')
  })

  it('should ignore events for sessions no chat has open', () => {
    expect(handleEvent(actions, event('elsewhere', 'message.start', 1))).toBeNull()
    expect(handlePrompt(clarifyRequest('elsewhere'))).toBeNull()
  })
})
