import { useEffect } from 'react'
import { applySnapshot, runRosterMutation } from './actions'
import { hasSharedLayout, publishRecoveredLayout, readRoster } from './data'
import type { RosterStore } from './data'
import { problemOf } from './roster'
import { fillInRules } from './rules'
import type { RulesBackend } from './rules'
import { useRoster } from './store'

/** What polling the roster asks of the backend: read it, publish a recovered layout, tell bots. */
type ConnectionBackend = Pick<
  RosterStore,
  'listBots' | 'listRooms' | 'olderRoomFolders' | 'updateLayout'
> &
  RulesBackend

// `backend` must be a stable reference, or polling restarts on every render.
export function useRosterConnection(backend: ConnectionBackend): void {
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
          void tellBotsAboutTalyx(
            backend,
            snapshot.bots.map((bot) => bot.name)
          )
          if (hasSharedLayout(snapshot)) return
          // Shown before it is written, so a failed write leaves the roster visible with an error.
          void runRosterMutation(backend, () => publishRecoveredLayout(backend, snapshot))
        }
      } catch (error) {
        if (!disposed && revision === useRoster.getState().revision)
          useRoster.setState({ loading: false, loadError: problemOf(error) })
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

// Best effort: a bot that misses the rules now gets them at the next start.
async function tellBotsAboutTalyx(backend: RulesBackend, profiles: string[]): Promise<void> {
  const missed = await fillInRules(backend, profiles)
  if (missed.length) console.warn('These bots were not told about Talyx:', missed.join(', '))
}
