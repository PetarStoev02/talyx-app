import { create } from 'zustand'
import { settingsApi } from '@shared/api/ipc'
import { hasProvider, type ProviderPresence } from './steps'

interface SetupState {
  setupDone: boolean | null
  /** Run setup again: the flow shows from Welcome even when every step is already done. */
  forced: boolean
  hasProvider: boolean | null
  hasOwnBot: boolean | null
  load: () => Promise<void>
  finish: () => Promise<void>
  restart: () => Promise<void>
  setHasProvider: (value: boolean) => void
  setHasOwnBot: (value: boolean) => void
}

export const useSetup = create<SetupState>((set) => ({
  setupDone: null,
  forced: false,
  hasProvider: null,
  hasOwnBot: null,
  load: async () => set({ setupDone: (await settingsApi.get()).setupDone }),
  finish: async () => {
    await settingsApi.set({ setupDone: true })
    set({ setupDone: true, forced: false })
  },
  restart: async () => {
    await settingsApi.set({ setupDone: false })
    // Unknown until read again: a provider or bot may have come or gone since the last read.
    set({ setupDone: false, forced: true, hasProvider: null, hasOwnBot: null })
  },
  setHasProvider: (value) => set({ hasProvider: value }),
  setHasOwnBot: (value) => set({ hasOwnBot: value })
}))

/** What a providers form reports after each change: the setup step and the chat's nudge read it. */
export function reportProvider(overview: ProviderPresence): void {
  useSetup.getState().setHasProvider(hasProvider(overview))
}
