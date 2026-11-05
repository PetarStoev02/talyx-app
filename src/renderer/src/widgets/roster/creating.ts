import { create } from 'zustand'

export type Creating = 'bot' | 'room' | 'folder' | null

/** Which create dialog is open. The `+` sits in the sidebar's title row, the dialogs in Roster. */
export const useCreating = create<{ creating: Creating; setCreating: (next: Creating) => void }>(
  (set) => ({ creating: null, setCreating: (creating) => set({ creating }) })
)
