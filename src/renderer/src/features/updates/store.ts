import { create } from 'zustand'
import { updaterApi } from '@shared/api/ipc'
import type { UpdateState } from '../../../../shared/updater'

interface UpdatesState {
  /** The Talyx release, as main reports it. */
  state: UpdateState
  /** The footer asked the engine gate to run the engine install; cleared when that flow ends. */
  engineInstallRequested: boolean
  requestEngineInstall: () => void
  clearEngineInstall: () => void
  /** Settings found a release: the update button opens its notice, then clears this. */
  noticeRequested: boolean
  requestNotice: () => void
  clearNotice: () => void
  /** Reads the current state and follows main's announcements from then on. */
  load: () => Promise<void>
}

let subscribed = false
// Counts main's announcements, so a read that comes back after one does not overwrite it.
let announcements = 0

export const useUpdates = create<UpdatesState>((set) => ({
  state: { kind: 'none' },
  engineInstallRequested: false,
  requestEngineInstall: () => set({ engineInstallRequested: true }),
  clearEngineInstall: () => set({ engineInstallRequested: false }),
  noticeRequested: false,
  requestNotice: () => set({ noticeRequested: true }),
  clearNotice: () => set({ noticeRequested: false }),
  load: async () => {
    // Subscribed before the read, so nothing announced meanwhile is missed; that news is newer.
    if (!subscribed) {
      subscribed = true
      updaterApi.onState((state) => {
        announcements++
        set({ state })
      })
    }
    const before = announcements
    const state = await updaterApi.state()
    if (announcements === before) set({ state })
  }
}))
