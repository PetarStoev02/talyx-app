import { create } from 'zustand'
import type { RosterProblem } from './roster'
import type { BotActivity, RosterSnapshot, Selection } from './types'

interface RosterState {
  snapshot: RosterSnapshot
  selection: Selection
  editingProfile: string | null
  activity: Record<string, BotActivity>
  unread: Record<string, boolean>
  // Each bot's chat activity time at the last snapshot, so a later move reads as a new reply.
  seen: Record<string, number>
  revision: number
  loading: boolean
  saving: boolean
  error: RosterProblem | null
  select: (selection: Selection) => void
  editProfile: (profile: string | null) => void
  clearError: () => void
  setActivity: (profile: string, activity: BotActivity) => void
  markUnread: (profile: string) => void
}

export const useRoster = create<RosterState>((set) => ({
  snapshot: { bots: [], folders: [], rooms: [], roomFolders: {} },
  selection: null,
  editingProfile: null,
  activity: {},
  unread: {},
  seen: {},
  revision: 0,
  loading: true,
  saving: false,
  error: null,
  select: (selection) =>
    set((state) => ({
      selection,
      editingProfile: null,
      unread: selection?.kind === 'bot' ? { ...state.unread, [selection.id]: false } : state.unread,
      seen: leftAt(state.selection, selection, state.seen)
    })),
  editProfile: (profile) => set({ editingProfile: profile }),
  clearError: () => set({ error: null }),
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

// A bot you leave was read up to now: its next poll must not show what you just saw as unread.
// Replies after this still mark it, live or on a later poll.
function leftAt(
  previous: Selection,
  next: Selection,
  seen: Record<string, number>
): Record<string, number> {
  if (previous?.kind !== 'bot' || (next?.kind === 'bot' && next.id === previous.id)) return seen
  return { ...seen, [previous.id]: Math.max(seen[previous.id] ?? 0, Date.now() / 1000) }
}
