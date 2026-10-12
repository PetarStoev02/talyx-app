import { create } from 'zustand'
import {
  agentApi,
  type ActivityStatus,
  type AgentDecision,
  type AgentEvent,
  type ApprovalRequest,
  type CaptureDestination,
  type ResultCard
} from '@shared/api/agent'

export type TranscriptEntry =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string; interim: boolean }
  | { kind: 'card'; card: ResultCard }
  | { kind: 'action'; label: string; ok: boolean; error: string | null }
  | { kind: 'error'; key: string; message: string }

export type Phase = 'idle' | 'working' | 'approval' | 'done' | 'error'

export interface AgentState {
  phase: Phase
  transcript: TranscriptEntry[]
  approval: ApprovalRequest | null
  lastError: { key: string; message: string } | null
  /** What the brain is doing right now; null when idle. */
  status: ActivityStatus | null
}

export const initialAgentState: AgentState = {
  phase: 'idle',
  transcript: [],
  approval: null,
  lastError: null,
  status: null
}

/** Pure, so the overlay and the Ask page share one tested state machine. */
export function applyAgentEvent(state: AgentState, event: AgentEvent): AgentState {
  switch (event.type) {
    case 'approval':
      return { ...state, phase: 'approval', approval: event.request }
    case 'status':
      return { ...state, status: { state: event.state, label: event.label } }
    case 'card':
      return { ...state, transcript: [...state.transcript, { kind: 'card', card: event.card }] }
    case 'text':
      if (event.text.trim().length === 0) return state
      return {
        ...state,
        transcript: [
          ...state.transcript,
          { kind: 'assistant', text: event.text, interim: event.interim }
        ]
      }
    case 'action':
      return {
        ...state,
        phase: 'working',
        approval: null,
        transcript: [
          ...state.transcript,
          { kind: 'action', label: event.label, ok: event.ok, error: event.error }
        ]
      }
    case 'error':
      return {
        ...state,
        lastError: { key: event.key, message: event.message },
        transcript: [...state.transcript, { kind: 'error', key: event.key, message: event.message }]
      }
    case 'done':
      return { ...state, phase: state.lastError ? 'error' : 'done', approval: null, status: null }
  }
}

interface AgentStore extends AgentState {
  run: (text: string) => Promise<void>
  /** Overlay Capture path — routes via capture:dump, not freeform agent:run. */
  dump: (text: string, chip: CaptureDestination | null) => Promise<void>
  approve: (decision: AgentDecision) => Promise<void>
  abort: () => Promise<void>
  reset: () => void
  /** Show a saved conversation; the next instruction continues it. */
  load: (entries: TranscriptEntry[]) => void
  /** Call once per window; returns the unsubscribe. */
  subscribe: () => () => void
}

export const useAgent = create<AgentStore>((set, get) => ({
  ...initialAgentState,
  async run(text) {
    const trimmed = text.trim()
    if (!trimmed || get().phase === 'working' || get().phase === 'approval') return
    set({
      phase: 'working',
      lastError: null,
      approval: null,
      transcript: [...get().transcript, { kind: 'user', text: trimmed }]
    })
    try {
      await agentApi.run(trimmed)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start'
      const key = keyForStartFailure(message)
      set(recordFailure(get(), key, message))
    }
  },
  async dump(text, chip) {
    const trimmed = text.trim()
    if (!trimmed || get().phase === 'working' || get().phase === 'approval') return
    set({
      phase: 'working',
      lastError: null,
      approval: null,
      transcript: [...get().transcript, { kind: 'user', text: trimmed }]
    })
    try {
      await agentApi.dump(trimmed, chip)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not capture'
      set(recordFailure(get(), 'capture_failed', message))
    }
  },
  async approve(decision) {
    set({ phase: 'working', approval: null })
    try {
      await agentApi.approve(decision)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not approve'
      set(recordFailure(get(), 'agent_failed', message))
    }
  },
  async abort() {
    try {
      await agentApi.abort()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not stop'
      set(recordFailure(get(), 'agent_failed', message))
    }
  },
  reset() {
    set({ ...initialAgentState })
    void agentApi.reset()
  },
  load(entries) {
    set({ ...initialAgentState, transcript: entries })
  },
  subscribe() {
    return agentApi.onEvent((event) => set(applyAgentEvent(get(), event)))
  }
}))

/** Surfaces a rejected agent IPC call as a transcript error and ends the turn. */
function recordFailure(state: AgentState, key: string, message: string): AgentState {
  return applyAgentEvent(applyAgentEvent(state, { type: 'error', key, message }), {
    type: 'done'
  })
}

/** agent:run rejects before any event is sent; the message is all we have. */
function keyForStartFailure(message: string): string {
  if (/API key/i.test(message)) return 'agent_missing_api_key'
  if (/Claude Code/i.test(message)) return 'agent_claude_code_missing'
  return 'agent_failed'
}
