import { useSyncExternalStore } from 'react'

const MINUTE = 60_000
let now = Date.now()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

// One clock for every caller, so "5 minutes ago" moves on in every row at once.
function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!timer) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      for (const notify of listeners) notify()
    }, MINUTE)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

/** The time now (ms since epoch), updated once a minute: for "5 minutes ago" labels. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, () => now)
}
