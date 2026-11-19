import { useState } from 'react'
import { useElapsed } from './useElapsed'

// A read or check can finish in a few milliseconds; the spin lasts at least this long to be seen.
const MIN_SPIN_MS = 600

/**
 * `spinning` is true while a task from `spin` runs and until `MIN_SPIN_MS` have passed since it
 * started, so a click on a fast refresh still shows.
 */
export function useMinSpin(): {
  spinning: boolean
  spin: (task: () => Promise<void>) => Promise<void>
} {
  const [running, setRunning] = useState(false)
  const [start, setStart] = useState<number | null>(null)
  const spun = useElapsed(start, MIN_SPIN_MS)

  async function spin(task: () => Promise<void>): Promise<void> {
    setRunning(true)
    setStart(Date.now())
    try {
      await task()
    } finally {
      setRunning(false)
    }
  }

  return { spinning: running || (start !== null && !spun), spin }
}
