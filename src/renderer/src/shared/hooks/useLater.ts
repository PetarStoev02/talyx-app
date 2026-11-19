import { useCallback, useRef } from 'react'
import { after } from '@shared/lib/timers'
import { useOnUnmount } from './useSubscription'

/**
 * One delayed call at a time: `later(ms, run)` replaces the one waiting, `cancel` drops it, and
 * leaving the screen drops it too. For a hover that opens or closes after a pause.
 */
export function useLater(): { later: (ms: number, run: () => void) => void; cancel: () => void } {
  const pending = useRef<(() => void) | null>(null)
  const cancel = useCallback((): void => {
    pending.current?.()
    pending.current = null
  }, [])
  const later = useCallback(
    (ms: number, run: () => void): void => {
      cancel()
      pending.current = after(ms, run)
    },
    [cancel]
  )
  useOnUnmount(cancel)
  return { later, cancel }
}
