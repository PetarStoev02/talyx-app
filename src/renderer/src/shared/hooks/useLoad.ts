import { useCallback, useEffect, useEffectEvent, useState } from 'react'

/**
 * Runs `load` after the first render and each time it changes (a new bot), and hands its result
 * to `loaded` or its error to `failed`; without `failed` the error is dropped (a `load` that logs
 * its own failure). A run that a newer one or an unmount overtook hands nothing, so a slow answer
 * for the last bot never shows for this one. The returned function runs it again (Try again).
 */
export function useLoad<T>(
  load: () => Promise<T>,
  settle: { loaded: (value: T) => void; failed?: (error: unknown) => void }
): () => void {
  const [attempt, setAttempt] = useState(0)
  const loaded = useEffectEvent(settle.loaded)
  const failed = useEffectEvent(settle.failed ?? ((): void => undefined))
  useEffect(() => {
    let current = true
    load().then(
      (value) => current && loaded(value),
      (error: unknown) => current && failed(error)
    )
    return () => {
      current = false
    }
  }, [load, attempt])
  return useCallback(() => setAttempt((n) => n + 1), [])
}
