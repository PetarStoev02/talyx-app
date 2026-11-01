import { useEffect, useState } from 'react'

const MINUTE_MS = 60_000

/** The current time, updated every minute, for "x min ago" labels. */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), MINUTE_MS)
    return () => clearInterval(id)
  }, [])
  return now
}
