import type { BotSignal } from './model'

export type ActivitySignal = Exclude<BotSignal, { kind: 'chat' | 'dm' }>

/** One line of wording for non-chat signals, shared by the feed and a bot's conversation. */
export function describeSignal(
  s: ActivitySignal,
  nameOf: (botId: string) => string
): string | null {
  switch (s.kind) {
    case 'task':
      return `Started: ${s.task}`
    case 'result':
      return `Done: ${s.text}`
    case 'task-failed':
      return `Task failed: ${s.reason}`
    case 'message':
      return `→ ${nameOf(s.toBotId)}: ${s.text}`
    case 't3':
      if (s.status === 'running') return `T3: ${s.title}`
      if (s.status === 'waiting') return `Waiting for you in T3: ${s.title}`
      return `Finished in T3: ${s.title}`
    case 'idle':
      return null
  }
}
