import { useEffect } from 'react'
import { applySnapshot, runRosterMutation } from './actions'
import { hasSharedLayout, publishRecoveredLayout, readRoster } from './data'
import type { RosterBackend } from './data'
import { problemOf } from './roster'
import { useRoster } from './store'

// `backend` must be a stable reference, or polling restarts on every render.
export function useRosterConnection(backend: RosterBackend): void {
  useEffect(() => {
    let disposed = false
    let inFlight = false
    let published = false
    const refresh = async (): Promise<void> => {
      if (inFlight || useRoster.getState().saving) return
      inFlight = true
      const revision = useRoster.getState().revision
      try {
        const snapshot = await readRoster(backend)
        if (disposed || revision !== useRoster.getState().revision) return
        applySnapshot(snapshot)
        if (!published) {
          published = true
          if (hasSharedLayout(snapshot)) return
          // Shown before it is written, so a failed write leaves the roster visible with an error.
          void runRosterMutation(backend, () => publishRecoveredLayout(backend, snapshot))
        }
      } catch (error) {
        if (!disposed && revision === useRoster.getState().revision)
          useRoster.setState({ loading: false, error: problemOf(error) })
      } finally {
        inFlight = false
      }
    }
    void refresh()
    const timer = setInterval(() => {
      void refresh()
    }, 10000)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [backend])
}
