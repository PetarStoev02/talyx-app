import { useEffect, useEffectEvent } from 'react'

/**
 * Runs `load` after the first render and each time it changes (a new bot, a retry), and hands
 * its result to `loaded` or its error to `failed`. A run that a newer one or an unmount
 * overtook hands nothing, so a slow answer for the last bot never shows for this one.
 */
export function useLoad<T>(
  load: () => Promise<T>,
  settle: { loaded: (value: T) => void; failed: (error: unknown) => void }
): void {
  const loaded = useEffectEvent(settle.loaded)
  const failed = useEffectEvent(settle.failed)
  useEffect(() => {
    let current = true
    load().then(
      (value) => current && loaded(value),
      (error: unknown) => current && failed(error)
    )
    return () => {
      current = false
    }
  }, [load])
}
