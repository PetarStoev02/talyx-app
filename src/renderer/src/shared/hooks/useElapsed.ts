import { useEffect, useState } from 'react'

/** True once `ms` have passed since `start` (ms since epoch); false while `start` is null. */
export function useElapsed(start: number | null, ms: number): boolean {
  // The start the wait has run out for; a new start begins a new wait.
  const [elapsedFor, setElapsedFor] = useState<number | null>(null)
  useEffect(() => {
    if (start === null) return
    const timer = setTimeout(() => setElapsedFor(start), Math.max(0, start + ms - Date.now()))
    return () => clearTimeout(timer)
  }, [start, ms])
  return start !== null && elapsedFor === start
}
