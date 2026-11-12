import { create } from 'zustand'
import { MCP_APPROVAL_TIMEOUT_MS } from '../../../../shared/mcp'
import type { ApprovalRequest } from './mcp'

interface Pending extends ApprovalRequest {
  id: string
  answer: (allowed: boolean) => void
}

interface ApprovalsState {
  /** Asked in order; the dialog shows the first. */
  queue: Pending[]
  ask: (request: ApprovalRequest) => Promise<boolean>
  /** Answers the first request and shows the next. */
  answer: (allowed: boolean) => void
}

/**
 * The approvals agents wait on: a tool that loses data runs only once the user allows it. One left
 * unanswered past its call's deadline (at most MCP_APPROVAL_TIMEOUT_MS) is a no, before main drops
 * the agent's call.
 */
export const useApprovals = create<ApprovalsState>((set, get) => {
  const settle = (id: string, allowed: boolean): void => {
    const pending = get().queue.find((item) => item.id === id)
    if (!pending) return
    set(({ queue }) => ({ queue: queue.filter((item) => item.id !== id) }))
    pending.answer(allowed)
  }
  return {
    queue: [],
    ask: (request) =>
      new Promise((resolve) => {
        const id = crypto.randomUUID()
        const wait = Math.min(MCP_APPROVAL_TIMEOUT_MS, request.until - Date.now())
        const timer = setTimeout(() => settle(id, false), Math.max(0, wait))
        const answer = (allowed: boolean): void => {
          clearTimeout(timer)
          resolve(allowed)
        }
        set(({ queue }) => ({ queue: [...queue, { ...request, id, answer }] }))
      }),
    answer: (allowed) => {
      const first = get().queue[0]
      if (first) settle(first.id, allowed)
    }
  }
})
