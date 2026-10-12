import type { ResultCard } from '../instruction/model/Capability'
import type { ConversationEntry } from '../conversation/model/Conversation'

/** One row of the approval card. */
export interface PendingProposal {
  id: string
  tool: string
  summary: string
  reversible: boolean
  operations: { label: string; reason: string }[]
}

export interface ApprovalRequest {
  text: string
  proposals: PendingProposal[]
}

export type ApprovalDecision = 'approve' | 'rest' | 'deny'

export interface SessionUi {
  approve(request: ApprovalRequest): Promise<ApprovalDecision>
  hide(): void
}

export interface ActionLogEntry {
  sessionId: string
  proposalId: string
  tool: string
  label: string
  payload: unknown
  inverse: unknown | null
  ok: boolean
  error: string | null
}

export interface ActionLog {
  append(entry: ActionLogEntry): void
}

/** What the brain is doing right now, for the orb and its label. */
export type ActivityState = 'thinking' | 'searching' | 'working' | 'waiting'

/** An empty label means "use the translated default for this state". */
export interface ActivityStatus {
  state: ActivityState
  label: string
}

export const THINKING: ActivityStatus = { state: 'thinking', label: '' }
export const WAITING: ActivityStatus = { state: 'waiting', label: '' }

export type AgentEvent =
  /** interim: narration the model wrote before calling a tool, not the answer. */
  | { type: 'text'; text: string; interim: boolean }
  | { type: 'status'; state: ActivityState; label: string }
  /** Structured answer for the UI, sent before the text that explains it. */
  | { type: 'card'; card: ResultCard }
  | { type: 'action'; label: string; ok: boolean; error: string | null }
  | { type: 'done' }
  | { type: 'error'; key: string; message: string }

/** AgentEvent plus the approval card, which the overlay (and the voice narrator) also observe. */
export type OverlayEvent = AgentEvent | { type: 'approval'; request: ApprovalRequest }

/**
 * Whatever turns an instruction into approved actions. Two implementations:
 * AgentSession (the user's API key) and ClaudeCodeBrain (the user's Claude Code).
 * The overlay, the approval card, the action log and the kill switch sit above it.
 */
export interface Brain {
  run(instruction: string): Promise<void>
  abort(): void
  /** Seed this brain with an earlier conversation so the next run continues it. */
  resume?(entries: ConversationEntry[]): void
}
