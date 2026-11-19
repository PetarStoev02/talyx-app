import { useEffect } from 'react'

/**
 * Polls while mounted. `start` runs after the first render and again each time it changes: it
 * makes the first call itself and returns what to call every `ms` after that (null: nothing).
 * `live()` turns false once that run is over (unmount, a new `start`), so a late answer can drop
 * itself. `start` must be stable (useCallback), or polling restarts on every render.
 */
export function usePolling(ms: number, start: (live: () => boolean) => (() => void) | null): void {
  useEffect(() => {
    let live = true
    const poll = start(() => live)
    const timer = poll && setInterval(poll, ms)
    return () => {
      live = false
      if (timer) clearInterval(timer)
    }
  }, [ms, start])
}
