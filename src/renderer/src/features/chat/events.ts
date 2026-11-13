import type { GatewayEvent, ServerRequest, SessionLiveInfo } from '@shared/engine/shared'
import { infoOf } from './chat'
import type { ChatActions } from './chat'
import { replyFinished } from './completionSound'
import { useChat } from './store'
import { addPrompt, applyEvent, fromHistory, needsRebuild } from './transcript'
import type { ApprovalChoice, ChatPrompt, ClarifyQuestion, Transcript } from './types'

export type ChatActivity = 'idle' | 'working' | 'waiting'

/** What one event or card did to a bot's chat, for the roster's dots and status lines. */
export interface ChatUpdate {
  profile: string
  // A reply finished that this window had not seen yet.
  completed: boolean
  activity: ChatActivity
}

export function handleEvent(actions: ChatActions, event: GatewayEvent): ChatUpdate | null {
  const chat = event.session_id ? useChat.getState().chatForSession(event.session_id) : null
  if (chat?.pending) useChat.getState().update(chat.profile, { pending: [...chat.pending, event] })
  if (!chat?.transcript) return null
  const { profile, transcript } = chat
  if (event.type === 'session.info')
    useChat.getState().update(profile, {
      info: infoOf(event.payload as SessionLiveInfo, chat.info)
    })
  // A gap or rewind may have swallowed the end of a turn: treated as one, so a waiting message
  // never stays stuck behind an answer this window did not see end.
  if (needsRebuild(event)) {
    void (event.type === 'session.replay_gap' ? actions.turnEnded : actions.rewound)(profile)
    return { profile, completed: false, activity: activityOf(transcript) }
  }
  const next = applyEvent(transcript, event)
  if (next !== transcript) useChat.getState().update(profile, { transcript: next })
  const completed = event.type === 'message.complete' && next !== transcript
  // A turn can also end with no reply frame at all (the engine only says it stopped running).
  // When there is one, it comes first (seen on engine 0.22.7), so this ends the turn once.
  if (completed || (transcript.running && !next.running)) void actions.turnEnded(profile)
  // Only a turn the engine marks complete is an answer: a stopped or failed one is not.
  if (completed && (event.payload as { status?: unknown } | null)?.status === 'complete')
    replyFinished()
  return { profile, completed, activity: activityOf(next) }
}

export function handlePrompt(request: ServerRequest): ChatUpdate | null {
  const sessionId = String(request.params.session_id ?? '')
  const chat = sessionId ? useChat.getState().chatForSession(sessionId) : null
  const prompt = promptOf(request)
  if (!chat || !prompt) return null
  // A snapshot delivers its open cards while the chat is still loading its history.
  const transcript = addPrompt(chat.transcript ?? fromHistory(sessionId, [], false), prompt)
  useChat.getState().update(chat.profile, { transcript })
  return { profile: chat.profile, completed: false, activity: activityOf(transcript) }
}

/**
 * The `host.onPrompt` handler. A request the chat cannot show (another kind, or a session no chat
 * has open) returns false, so the channel declines it at once instead of the bot waiting it out.
 */
export function promptHandler(
  onUpdate: (update: ChatUpdate) => void
): (request: ServerRequest) => false | undefined {
  return (request) => {
    const update = handlePrompt(request)
    if (!update) return false
    onUpdate(update)
    return undefined
  }
}

export function activityOf(transcript: Transcript): ChatActivity {
  if (transcript.prompts.length) return 'waiting'
  return transcript.running ? 'working' : 'idle'
}

function promptOf(request: ServerRequest): ChatPrompt | null {
  const params = request.params as Record<string, unknown>
  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  if (request.method === 'clarify') {
    const questions = (Array.isArray(params.questions) ? params.questions : []).map(
      (raw: Record<string, unknown>): ClarifyQuestion => ({
        qid: String(raw.qid ?? request.id),
        question: String(raw.question ?? ''),
        choices: strings(raw.choices),
        multiSelect: raw.multi_select === true
      })
    )
    const answers = (params.answers as Record<string, string> | null | undefined) ?? {}
    return { kind: 'clarify', id: request.id, questions, answers }
  }
  if (request.method === 'approval') {
    return {
      kind: 'approval',
      id: request.id,
      command: String(params.command ?? ''),
      description: String(params.description ?? ''),
      choices: strings(params.choices),
      respond: (choice: ApprovalChoice) => request.respond({ choice })
    }
  }
  return null
}
