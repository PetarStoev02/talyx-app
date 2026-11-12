import type { Problem } from '@shared/lib/problem'
export type ChatItem =
  | { kind: 'user'; id: string; text: string; images: string[] }
  | {
      kind: 'bot'
      id: string
      text: string
      streaming: boolean
      error: string | null
      // The user stopped the turn part way: the text is what the bot wrote until then.
      stopped: boolean
      // Who spoke: a room member, or a bot that delivered a message into this chat; null for the
      // chat's own bot. A delivery names its sender by @handle, which is the profile's name except
      // for Talyx (the engine's manager handle).
      sender: { name: string; profile: string } | null
    }
  | {
      kind: 'tool'
      id: string
      name: string
      label: string
      seconds: number | null
      done: boolean
      // The profile a `message_agent` call asks; null for every other tool.
      target: string | null
    }
  // A line the engine wrote into the chat (a finished job, a model switch), not a message.
  | { kind: 'notice'; id: string; text: string }

/** What the chat shows as a message: everything but a tool call. */
export type MessageItem = Exclude<ChatItem, { kind: 'tool' }>

export interface ClarifyQuestion {
  qid: string
  question: string
  choices: string[]
  multiSelect: boolean
}

export type ApprovalChoice = 'deny' | 'once' | 'session' | 'always'

export type ChatPrompt =
  | { kind: 'clarify'; id: string; questions: ClarifyQuestion[]; answers: Record<string, string> }
  | {
      kind: 'approval'
      id: string
      command: string
      description: string
      choices: string[]
      respond: (choice: ApprovalChoice) => void
    }

export interface Transcript {
  sessionId: string
  items: ChatItem[]
  prompts: ChatPrompt[]
  running: boolean
  // The last per-session event sequence applied, so a replayed frame is not applied twice.
  lastSeq: number
  // The replay epoch that sequence counts in; a new epoch restarts it.
  epoch: string | null
  // How far the streaming turn's reply is applied, when the engine stamps its frames; null otherwise.
  stream: StreamCursor | null
  // What the engine says while it waits on a provider before retrying; null when it is not waiting.
  wait: string | null
  // The turns that failed here, oldest first. The engine never stores one, so a reload puts them
  // back where they were.
  failed: FailedTurn[]
  // Messages sent while the bot answered, oldest first. They wait under the answer and join the
  // chat when the turn that answers them starts, so the running answer stays in one piece.
  queued: ChatItem[]
}

/** A failed turn's message and error bubble, and the id of the item they followed (null: first). */
export interface FailedTurn {
  after: string | null
  items: ChatItem[]
}

/**
 * The engine (0.22.7 on) re-sends a turn's frames under new seqs on some roads (a reconnect replay,
 * a superseded attempt), so a stamped turn is applied by position: the segment its deltas extend
 * and the UTF-16 code units of it already applied.
 */
export interface StreamCursor {
  turnId: string
  segment: number
  end: number
}

/** One row of a hosted room's log, as `groups.log` returns it. */
export interface RoomEvent {
  seq: number
  event_id: string
  kind: string
  actor: { kind: string; id: string; display_name?: string }
  payload: Record<string, unknown>
  created_at: number
}

/** A file sent with a room message: the manifest `groups.send` takes and the log keeps. */
export interface RoomAttachment {
  attachment_id: string
  kind: string
  name: string
  mime: string
  size: number
}

/** A member's turn that waits on you: an approval, or a turn that stopped part way. */
export interface RoomTask {
  kind: 'approval' | 'retry' | 'discard'
  member_id: string
  task_id: string
  execution_generation: number
  request_id: string | null
  command: string
  description: string
}

export type MemberPhase = 'queued' | 'working'

export interface RoomView {
  events: RoomEvent[]
  // The models the members' room sessions run on, each once: one shared model, several when they
  // differ, none before any member has answered here (a member starts on its own bot's model).
  models: string[]
  // The last log seq read, so a poll asks only for what came after it.
  lastSeq: number
  // The engine runs the room's members; without it the room can be read, not sent to.
  live: boolean
  working: boolean
  phases: Record<string, MemberPhase>
  tasks: RoomTask[]
  // The last send that failed, so sending the same words again reuses its event id and the
  // engine posts it once even if the first attempt did land.
  failedSend: { eventId: string; draft: string } | null
  loading: boolean
  // Why the last read failed; the next read that works clears it.
  error: Problem | null
  // Why your last send, stop, answer, retry, discard or model switch failed; it stays until one
  // of them works.
  actionError: Problem | null
}
