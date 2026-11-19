import { useState } from 'react'
import { useElapsed } from './useElapsed'

/** A flag that `raise` turns on for `ms`: "Copied." on a Copy button, then Copy again. */
export function useFlash(ms: number): [boolean, () => void] {
  const [since, setSince] = useState<number | null>(null)
  const over = useElapsed(since, ms)
  const on = since !== null && !over
  // Raising it while it is on leaves it to go off when it would have.
  const raise = (): void => {
    if (!on) setSince(Date.now())
  }
  return [on, raise]
}
