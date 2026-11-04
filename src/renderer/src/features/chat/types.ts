export type ChatItem =
  | { kind: 'user'; id: string; text: string; images: string[] }
  | { kind: 'bot'; id: string; text: string; streaming: boolean; error: string | null }
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
  // A message another bot delivered into this chat, shown apart from what the user typed.
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
