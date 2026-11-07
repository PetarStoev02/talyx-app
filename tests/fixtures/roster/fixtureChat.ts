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
// Developer opens waiting on you, with an approval card and a question card.
const STEP_MS = 120
const REPLY = 'On it. I will look into this and post a **short summary** here when it is ready.'
const DENIED = 'Okay, I will not run it.'
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
  ],
  developer: [
    { id: 1, role: 'user', content: 'The CSV export drops the last row. Can you fix it?' },
    {
      id: 2,
      role: 'assistant',
      content:
        'Found it: the export loop stopped one row early. **The fix is in and the tests pass.**'
    },
    { id: 3, role: 'user', content: 'Great, ship it.' }
  ]
}
let seq = 100
// Developer's cards open once per page load, with its history, so the chat opens scrolled to them.
let developerAsked = false
// Each open question card: its last question, whose answer settles it, and the reply that follows.
const clarifies: Record<string, { last: string; reply: (answer: string) => string }> = {}
// When each profile's scripted steps run out, so two replies never stream into one bubble.
const idleAt: Record<string, number> = {}

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
  const ask = (
    profile: string,
    request: Omit<ServerRequest, 'respond' | 'fail'>,
    reply: (choice: string) => string = (choice) => (choice === 'deny' ? DENIED : REPLY)
  ): void =>
    show(
      handlePrompt({
        ...request,
        respond: ({ choice }) => {
          emit(profile, 'approval.settled', { prompt_id: request.id })
          play(profile, finish(profile, reply(String(choice))))
        },
        fail: () => undefined
      })
    )
  const askClarify = (
    profile: string,
    questions: Array<Record<string, unknown>>,
    reply: (answer: string) => string = () => REPLY
  ): void => {
    const id = `clarify-${seq}`
    clarifies[id] = { last: String(questions.at(-1)!.qid), reply }
    ask(profile, { id, method: 'clarify', params: { session_id: sessionOf(profile), questions } })
  }

  function play(profile: string, steps: Array<() => void>): void {
    const start = Math.max(Date.now(), idleAt[profile] ?? 0)
    idleAt[profile] = start + STEP_MS * steps.length
    steps.forEach((step, index) => setTimeout(step, start - Date.now() + STEP_MS * (index + 1)))
  }

  // Streams a short reply word by word, then stores it as the engine would.
  function finish(profile: string, text = REPLY): Array<() => void> {
    return [
      () => emit(profile, 'message.start'),
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
      return play(profile, [
        start,
        () =>
          askClarify(profile, [
            { qid: 'q1', question: 'Which quarter?', choices: ['Q3 2026', 'Q4 so far', 'Both'] },
            {
              qid: 'q2',
              question: 'Which regions?',
              choices: ['North', 'South'],
              multi_select: true
            }
          ])
      ])
    if (/approve/i.test(text))
      return play(profile, [
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
    play(profile, [start, ...delegation, ...finish(profile)])
  }

  // A turn shows only its last reply, so each answer's reply repeats the ones before it.
  function askDeveloper(): void {
    developerAsked = true
    const notes: string[] = []
    const note = (text: string): string => {
      notes.push(text)
      return notes.join(' ')
    }
    ask(
      'developer',
      {
        id: 'approval-build',
        method: 'approval',
        params: {
          session_id: sessionOf('developer'),
          command: 'rm -rf build/ && npm run build',
          description: 'Rebuilds the app with the fix, so you can try the export.',
          choices: ['once', 'session', 'always', 'deny']
        }
      },
      (choice) =>
        note(
          choice === 'deny'
            ? 'Okay, I left the build alone.'
            : 'Rebuilt: the export keeps **all 1,204 rows** of the test file.'
        )
    )
    askClarify(
      'developer',
      [
        {
          qid: 'release',
          question: 'Which release should get the fix?',
          choices: ['1.4.2 patch', '1.5 update', 'Both']
        }
      ],
      (answer) =>
        note(`The fix ships in **${answer === 'Both' ? 'both releases' : `the ${answer}`}**.`)
    )
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
          if (profile === 'developer' && !developerAsked) askDeveloper()
          return {
            running: false,
            last_sequence: seq,
            info: { model: DEFAULT_MODEL, provider: PROVIDER, reasoning_effort: 'medium' }
          }
        case 'prompt.submit':
          history[profile].push({ id: Date.now(), role: 'user', content: String(params.text) })
          reply(profile, String(params.text))
          return {}
        case 'clarify.lock': {
          const clarify = clarifies[String(params.request_id)]
          if (clarify?.last === params.question_id) {
            setTimeout(() => emit(profile, 'clarify.settled', { prompt_id: params.request_id }))
            play(profile, finish(profile, clarify.reply(String(params.answer))))
          }
          return {}
        }
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
