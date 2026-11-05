import { useEffect, useState } from 'react'

// The longest closing animation: --duration-move in theme.css.
export const CLOSE_MS = 200

/** True while `open`, and for CLOSE_MS after it turns false, so a closing part can animate out. */
export function useStayMounted(open: boolean): boolean {
  const [gone, setGone] = useState(!open)
  // Opening again cancels a close in progress (adjusted while rendering, not in an effect).
  if (open && gone) setGone(false)
  useEffect(() => {
    if (open) return
    const timer = setTimeout(() => setGone(true), CLOSE_MS)
    return () => clearTimeout(timer)
  }, [open])
  return open || !gone
}

/**
 * The last value that was there: while a part closes, it keeps showing what it showed. `value`
 * should be stable (a store object), as each new one replaces the kept one.
 */
export function useLastValue<T>(value: T | null | undefined | false): T | null {
  const [last, setLast] = useState<T | null>(value || null)
  if (value && value !== last) setLast(value)
  return value || last
}

/**
 * The class that fades content in when it replaces a loading placeholder. Content that was
 * there at once (a chat already loaded) shows without it, so switching stays instant.
 */
export function useArrival(loading: boolean): string {
  const [waited, setWaited] = useState(loading)
  if (loading && !waited) setWaited(true)
  return waited && !loading ? 'animate-arrive' : ''
}
