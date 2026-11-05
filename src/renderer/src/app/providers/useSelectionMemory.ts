import { useEffect, useState } from 'react'
import { startSelection } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import { settingsApi } from '@shared/api/ipc'
import { reportError } from '@shared/lib/report'

/**
 * The Agents page always has a chat open: on launch the one open last time, and Talyx whenever
 * the open bot or room goes away (deleted, hidden, disbanded). Every pick is saved for next time.
 */
export function useSelectionMemory(): void {
  // A first read that failed (engine down) has no bots yet; the restore waits for a real roster.
  const loaded = useRoster((state) => !state.loading && state.snapshot.bots.length > 0)
  const selection = useRoster((state) => state.selection)
  const [restored, setRestored] = useState(false)

  // Once, after the first roster read: the saved pick, if it is still there.
  useEffect(() => {
    if (!loaded || restored) return
    settingsApi
      .get()
      .then((settings) => settings.lastSelection)
      .catch((error: unknown) => {
        reportError('settings', error)
        return null
      })
      .then((saved) => {
        const { snapshot, select } = useRoster.getState()
        // A pick made while the settings were on their way wins over the saved one.
        if (!useRoster.getState().selection) select(startSelection(snapshot, saved))
        setRestored(true)
      })
  }, [loaded, restored])

  useEffect(() => {
    if (!restored) return
    if (selection) settingsApi.save({ lastSelection: selection })
    else {
      const { snapshot, select } = useRoster.getState()
      const fallback = startSelection(snapshot, null)
      if (fallback) select(fallback)
    }
  }, [selection, restored, loaded])
}
