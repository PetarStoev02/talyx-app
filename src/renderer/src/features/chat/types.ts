export type ChatItem =
  | { kind: 'user'; id: string; text: string; images: string[] }
  | {
      kind: 'bot'
      id: string
      text: string
      streaming: boolean
      error: string | null
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
  error: string | null
}
