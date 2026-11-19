import { useEffect, useState } from 'react'

/**
 * The time now (ms since epoch), read again every `ms` while mounted: for a running count of
 * seconds. For "5 minutes ago" labels use useNow, the one shared minute clock.
 */
export function useClock(ms: number): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(timer)
  }, [ms])
  return now
}
