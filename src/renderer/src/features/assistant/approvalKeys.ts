import type { AgentDecision } from '@shared/api/agent'

/** Keys typed into another app just before the card appeared must not decide it. */
export const KEY_GUARD_MS = 500

export interface CardKey {
  key: string
  code: string
  repeat: boolean
  altKey: boolean
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
}

/**
 * The card's keyboard shortcuts. Escape denies at any time — denying is always
 * safe. Approving waits until the card has been on screen for KEY_GUARD_MS and
 * ignores auto-repeat; "approve the rest" needs Option so a stray `a` never
 * grants a whole task.
 */
export function decisionForKey(e: CardKey, msSinceShown: number): AgentDecision | null {
  if (e.key === 'Escape') return 'deny'
  if (e.repeat || msSinceShown < KEY_GUARD_MS) return null
  if (e.key === 'Enter' && !e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) return 'approve'
  // e.code, not e.key: Option+A types "å" on a Mac keyboard.
  if (e.code === 'KeyA' && e.altKey && !e.metaKey && !e.ctrlKey) return 'rest'
  return null
}
