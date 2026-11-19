import { useEffect, useEffectEvent } from 'react'

/**
 * Calls `leave` with the key that was, each time a non-null `key` gives way: it changes, turns
 * null, or the part unmounts. `leave` always sees the latest props.
 */
export function useOnLeave<K>(key: K | null, leave: (key: K) => void): void {
  const left = useEffectEvent(leave)
  useEffect(() => {
    if (key === null) return
    return () => left(key)
  }, [key])
}
