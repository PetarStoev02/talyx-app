import { useEffectEvent, useLayoutEffect } from 'react'

/** Runs `run` once, after the first render and before the browser paints it. */
export function useBeforePaint(run: () => void): void {
  const once = useEffectEvent(run)
  useLayoutEffect(() => {
    once()
  }, [])
}
