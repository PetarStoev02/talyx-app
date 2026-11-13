import { create } from 'zustand'

interface CheatSheetState {
  open: boolean
  setOpen: (open: boolean) => void
}

/** Whether the keyboard shortcuts cheat sheet is open (⌘/). */
export const useCheatSheet = create<CheatSheetState>((set) => ({
  open: false,
  setOpen: (open) => set({ open })
}))
