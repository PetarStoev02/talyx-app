import { create } from 'zustand'
import type { ApprovalRequest } from './mcp'

interface Pending extends ApprovalRequest {
  answer: (allowed: boolean) => void
}

interface ApprovalsState {
  /** Asked in order; the dialog shows the first. */
  queue: Pending[]
  ask: (request: ApprovalRequest) => Promise<boolean>
  /** Answers the first request and shows the next. */
  answer: (allowed: boolean) => void
}

/** The approvals agents wait on: a tool that loses data runs only once the user allows it. */
export const useApprovals = create<ApprovalsState>((set, get) => ({
  queue: [],
  ask: (request) =>
    new Promise((answer) => set(({ queue }) => ({ queue: [...queue, { ...request, answer }] }))),
  answer: (allowed) => {
    const [first, ...rest] = get().queue
    if (!first) return
    set({ queue: rest })
    first.answer(allowed)
  }
}))
