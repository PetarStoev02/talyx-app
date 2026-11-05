import { chatActions } from '../../../src/renderer/src/features/chat/chat'
import type { ChatActions, ChatBackend } from '../../../src/renderer/src/features/chat/chat'
import type { ProvidersBackend } from '../../../src/renderer/src/features/providers/providers'
import { handleEvent, handlePrompt } from '../../../src/renderer/src/features/chat/events'
import type { ChatUpdate } from '../../../src/renderer/src/features/chat/events'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import { DEFAULT_MODEL, PROVIDER } from './fixtureProviders'
import type { GatewayEvent, ServerRequest } from '../../../src/renderer/src/shared/engine/shared'

// Deliberately in-memory: a scripted bot per profile. Words in your message pick the script:
// "clarify" asks two questions, "approve" asks to run a command, "ask" delegates to another bot.
const STEP_MS = 120
const FIXTURE_IMAGE =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#8b7cf6"/></svg>'
  )
const history: Record<string, Array<Record<string, unknown>>> = {
  default: [
    { id: 1, role: 'user', content: 'How did Q3 margins do?' },
    {
      id: 2,
      role: 'assistant',
      content: '',
      tool_calls: [
        { id: 'c1', function: { name: 'message_agent', arguments: '{"target":"analyst"}' } }
      ]
    },
    { id: 3, role: 'tool', content: 'sent', tool_call_id: 'c1' },
    {
      id: 4,
      role: 'user',
      content:
        'Message from 🤖 Analyst (@analyst): Q3 gross margin is 41%, up 4 points on Q2. Costs held flat and the September price change did the rest.'
    },
    {
      id: 5,
      role: 'assistant',
      content:
        '**Q3 margins are up 4 points**, to 41%.\n\n- Costs held flat\n- The September price change did the rest\n\nAnalyst can split it by region next.'
    }
  ],
  // Waiting on you: its last answer is a question.
  analyst: [
    { id: 1, role: 'user', content: 'Turn the Q3 margin numbers into a one-page report.' },
    {
      id: 2,
      role: 'assistant',
      content:
        'Happy to. **Which regions should the report cover?** North and South are ready; West is still closing its books.'
    }
  ]
}
let seq = 100

/** `providers` answers the model lists, so a provider added in Settings shows in every picker. */
export function fixtureChat(providers: ProvidersBackend): ChatActions {
  const sessionOf = (profile: string): string => `${profile}-chat`
  const emit = (profile: string, type: string, payload: Record<string, unknown> = {}): void =>
    show(
      handleEvent(actions, {
        type,
        payload,
        session_id: sessionOf(profile),
        seq: ++seq
      } as GatewayEvent)
    )
  const ask = (profile: string, request: Omit<ServerRequest, 'respond' | 'fail'>): void =>
    show(
      handlePrompt({
        ...request,
        respond: () => {
          emit(profile, 'approval.settled', { prompt_id: request.id })
          play(finish(profile))
        },
        fail: () => undefined
      })
    )

  function play(steps: Array<() => void>): void {
    steps.forEach((step, index) => setTimeout(step, STEP_MS * (index + 1)))
  }

  // Streams a short reply word by word, then stores it as the engine would.
  function finish(profile: string): Array<() => void> {
    const text = 'On it. I will look into this and post a **short summary** here when it is ready.'
    return [
      ...text.split(' ').map((word) => () => emit(profile, 'message.delta', { text: `${word} ` })),
      () => {
        history[profile].push({ id: Date.now(), role: 'assistant', content: text })
        emit(profile, 'message.complete')
      }
    ]
  }

  function reply(profile: string, text: string): void {
    const start = (): void => emit(profile, 'message.start')
    if (/clarify/i.test(text))
      return play([
        start,
        () =>
          ask(profile, {
            id: `clarify-${seq}`,
            method: 'clarify',
            params: {
              session_id: sessionOf(profile),
              questions: [
                {
                  qid: 'q1',
                  question: 'Which quarter?',
                  choices: ['Q3 2026', 'Q4 so far', 'Both']
                },
                {
                  qid: 'q2',
                  question: 'Which regions?',
                  choices: ['North', 'South'],
                  multi_select: true
                }
              ]
            }
          })
      ])
    if (/approve/i.test(text))
      return play([
        start,
        () =>
          ask(profile, {
            id: `approval-${seq}`,
            method: 'approval',
            params: {
              session_id: sessionOf(profile),
              command: 'rm -rf build/',
              description: 'Clears the old build before rebuilding.',
              choices: ['once', 'session', 'always', 'deny']
            }
          })
      ])
    const tool = `t${seq}`
    const delegation = /ask/i.test(text)
      ? [
          () =>
            emit(profile, 'tool.start', {
              tool_id: tool,
              name: 'message_agent',
              args: { target: 'analyst' }
            }),
          () => {
            history[profile].push({
              id: Date.now(),
              role: 'tool',
              name: 'message_agent',
              args: { target: 'analyst' },
              content: 'sent'
            })
            emit(profile, 'tool.complete', { tool_id: tool, name: 'message_agent', duration_s: 2 })
          }
        ]
      : []
    play([start, ...delegation, ...finish(profile)])
  }

  const request: ChatBackend['request'] = async <T>(
    profile: string,
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<T> => {
    const answer = ((): unknown => {
      switch (method) {
        case 'session.list':
          return { sessions: history[profile] ? [{ id: sessionOf(profile) }] : [] }
        case 'session.create':
          return { session_id: sessionOf(profile) }
        case 'session.title':
          history[profile] ??= []
          return {}
        case 'session.resume':
          return {
            running: false,
            last_sequence: seq,
            info: { model: DEFAULT_MODEL, provider: PROVIDER, reasoning_effort: 'medium' }
          }
        case 'prompt.submit':
          history[profile].push({ id: Date.now(), role: 'user', content: String(params.text) })
          reply(profile, String(params.text))
          return {}
        case 'clarify.lock':
          if (params.question_id === 'q2')
            setTimeout(() => emit(profile, 'clarify.settled', { prompt_id: params.request_id }))
          return {}
        default:
          return {}
      }
    })()
    return answer as T
  }

  const http: ChatBackend['http'] = async <T>({ path }: { path: string }): Promise<T> => {
    const profile = new URL(path, 'http://fixture.invalid').searchParams.get('profile') ?? ''
    if (path.startsWith('/api/sessions/')) return { messages: history[profile] ?? [] } as T
    if (path.startsWith('/api/model/options') || path.startsWith('/api/providers/'))
      return providers.http<T>({ path, profile })
    if (path.startsWith('/api/chat/image-upload'))
      return { path: '/images/fixture.png', mime_type: 'image/png' } as T
    if (path.startsWith('/api/audio/transcribe'))
      return { transcript: 'Sum up this week in three lines.' } as T
    if (path.startsWith('/api/media')) return { data_url: FIXTURE_IMAGE } as T
    throw new Error('Unsupported fixture call')
  }

  const actions = chatActions({ request, http })
  return actions
}

function show(update: ChatUpdate | null): void {
  if (!update) return
  useRoster.getState().setActivity(update.profile, update.activity)
  if (update.completed) useRoster.getState().markUnread(update.profile)
}
