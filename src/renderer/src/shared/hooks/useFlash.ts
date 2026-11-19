import { useState } from 'react'
import { useElapsed } from './useElapsed'

/** A flag that `raise` turns on for `ms`: "Copied." on a Copy button, then Copy again. */
export function useFlash(ms: number): [boolean, () => void] {
  const [since, setSince] = useState<number | null>(null)
  const over = useElapsed(since, ms)
  const on = since !== null && !over
  // Raising it while it is on leaves it to go off when it would have. Read when it is raised
  // (a copy can finish after the flag went off), not from the render that made `raise`.
  const raise = (): void => {
    const now = Date.now()
    setSince((last) => (last !== null && now - last < ms ? last : now))
  }
  return [on, raise]
}
