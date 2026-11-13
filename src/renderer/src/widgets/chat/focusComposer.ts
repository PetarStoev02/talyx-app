// Leaving Settings, the Agents page mounts its chat, and may mount it again, within this time.
const WANTED_MS = 1000

let wantedAt = -Infinity

/**
 * Puts the cursor in the open chat's or room's message box (⌘L). A box that mounts just after,
 * because the page was still opening, takes it on mount (`composerWanted`).
 */
export function focusComposer(): void {
  wantedAt = Date.now()
  document.querySelector<HTMLTextAreaElement>('textarea[data-composer]')?.focus()
}

/** Whether a message box mounting now should take focus. */
export function composerWanted(): boolean {
  return Date.now() - wantedAt < WANTED_MS
}
