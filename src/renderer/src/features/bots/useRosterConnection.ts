import { useCallback } from 'react'
import { usePolling } from '@shared/hooks/usePolling'
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

const POLL_MS = 10_000

// `backend` must be a stable reference, or polling restarts on every render.
export function useRosterConnection(backend: ConnectionBackend): void {
  const start = useCallback(
    (live: () => boolean): (() => void) => {
      const refresh = rosterRefresh(backend, live)
      void refresh()
      return (): void => void refresh()
    },
    [backend]
  )
  usePolling(POLL_MS, start)
}

/**
 * One connection's refresh: reads the roster unless a read or a save is under way, and the first
 * read tells the bots about Talyx and publishes a recovered layout. A read that `live` outlived,
 * or that a roster change overtook, is dropped.
 */
function rosterRefresh(backend: ConnectionBackend, live: () => boolean): () => Promise<void> {
  let inFlight = false
  let published = false
  return async (): Promise<void> => {
    if (inFlight || useRoster.getState().saving) return
    inFlight = true
    const revision = useRoster.getState().revision
    try {
      const snapshot = await readRoster(backend)
      if (!live() || revision !== useRoster.getState().revision) return
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
      if (live() && revision === useRoster.getState().revision)
        useRoster.setState({ loading: false, loadError: problemOf(error) })
    } finally {
      inFlight = false
    }
  }
}

// Best effort: a bot that misses the rules now gets them at the next start.
async function tellBotsAboutTalyx(backend: RulesBackend, profiles: string[]): Promise<void> {
  const missed = await fillInRules(backend, profiles)
  if (missed.length) console.warn('These bots were not told about Talyx:', missed.join(', '))
}
