import { useEffect, useEffectEvent } from 'react'

/**
 * Calls `onChange` with `value` after the first render and after each render that changed it
 * (`Object.is`). `onChange` always sees the latest props; a new `onChange` alone calls nothing.
 */
export function useOnChange<T>(value: T, onChange: (value: T) => void): void {
  const changed = useEffectEvent(onChange)
  useEffect(() => {
    changed(value)
  }, [value])
}
