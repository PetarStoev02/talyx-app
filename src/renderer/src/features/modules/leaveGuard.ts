import type { LeaveGuard } from '@contract/moduleHost'

let guard: LeaveGuard | null = null

/** Set by the open module page while it holds unsaved work; null clears it. */
export function setLeaveGuard(next: LeaveGuard | null): void {
  guard = next
}

/**
 * Whether the user may leave the open module page. A guard that fails lets them leave: a broken
 * module must never trap the user on its page.
 */
export async function mayLeave(): Promise<boolean> {
  if (!guard) return true
  try {
    return (await guard()) !== false
  } catch (error) {
    console.error('[Modules] Leave guard failed; leaving anyway', error)
    return true
  }
}
