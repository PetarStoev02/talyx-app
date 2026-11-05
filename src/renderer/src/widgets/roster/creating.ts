import { create } from 'zustand'

export type Creating = 'bot' | 'room' | 'folder' | null

interface CreatingState {
  creating: Creating
  /** The folder a new bot goes in, from that folder's empty state; null lets the dialog pick. */
  inFolder: string | null
  setCreating: (next: Creating) => void
  createBotIn: (folderId: string) => void
}

/** Which create dialog is open. The `+` sits in the sidebar's title row, the dialogs in Roster. */
export const useCreating = create<CreatingState>((set) => ({
  creating: null,
  inFolder: null,
  setCreating: (creating) => set({ creating, inFolder: null }),
  createBotIn: (folderId) => set({ creating: 'bot', inFolder: folderId })
}))
