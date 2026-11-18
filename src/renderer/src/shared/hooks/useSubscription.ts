import { useEffect, useEffectEvent } from 'react'

/**
 * Calls `subscribe` once on mount and the function it returns on unmount: a listener on a store,
 * the engine or the page, for as long as the part is on screen.
 */
export function useSubscription(subscribe: () => () => void): void {
  const start = useEffectEvent(subscribe)
  useEffect(() => {
    return start()
  }, [])
}

/** Calls `run` once, when the part leaves the screen. */
export function useOnUnmount(run: () => void): void {
  const leave = useEffectEvent(run)
  useEffect(() => () => leave(), [])
}

/** Listens for `type` on the window while mounted; `listener` always sees the latest props. */
export function useWindowEvent<K extends keyof WindowEventMap>(
  type: K,
  listener: (event: WindowEventMap[K]) => void
): void {
  const heard = useEffectEvent(listener)
  useEffect(() => {
    const onEvent = (event: WindowEventMap[K]): void => heard(event)
    window.addEventListener(type, onEvent)
    return () => window.removeEventListener(type, onEvent)
  }, [type])
}
