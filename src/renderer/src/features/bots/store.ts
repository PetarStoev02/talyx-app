import { create } from 'zustand'
import type { BotActivity, RosterSnapshot, Selection } from './types'

interface RosterState {
  snapshot: RosterSnapshot
  selection: Selection
  editingProfile: string | null
  activity: Record<string, BotActivity>
  unread: Record<string, boolean>
  revision: number
  loading: boolean
  saving: boolean
  error: string | null
  select: (selection: Selection) => void
  setActivity: (profile: string, activity: BotActivity) => void
  markUnread: (profile: string) => void
}

export const useRoster = create<RosterState>((set) => ({
  snapshot: { bots: [], folders: [], rooms: [], roomFolders: {} },
  selection: null,
  editingProfile: null,
  activity: {},
  unread: {},
  revision: 0,
  loading: true,
  saving: false,
  error: null,
  select: (selection) =>
    set((state) => ({
      selection,
      editingProfile: null,
      unread: selection?.kind === 'bot' ? { ...state.unread, [selection.id]: false } : state.unread
    })),
  setActivity: (profile, activity) =>
    set((state) => ({ activity: { ...state.activity, [profile]: activity } })),
  markUnread: (profile) =>
    set((state) => ({
      unread: {
        ...state.unread,
        [profile]: !(state.selection?.kind === 'bot' && state.selection.id === profile)
      }
    }))
}))
