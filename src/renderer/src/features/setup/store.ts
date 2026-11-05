import { create } from 'zustand'
import { settingsApi } from '@shared/api/ipc'

interface SetupState {
  setupDone: boolean | null
  hasProvider: boolean | null
  hasOwnBot: boolean | null
  load: () => Promise<void>
  finish: () => Promise<void>
  restart: () => Promise<void>
  setHasProvider: (value: boolean) => void
  setHasOwnBot: (value: boolean) => void
}

export const useSetup = create<SetupState>((set) => {
  const save = async (setupDone: boolean): Promise<void> => {
    await settingsApi.set({ setupDone })
    set({ setupDone })
  }
  return {
    setupDone: null,
    hasProvider: null,
    hasOwnBot: null,
    load: async () => set({ setupDone: (await settingsApi.get()).setupDone }),
    finish: () => save(true),
    restart: () => save(false),
    setHasProvider: (value) => set({ hasProvider: value }),
    setHasOwnBot: (value) => set({ hasOwnBot: value })
  }
})
