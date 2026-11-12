import { create } from 'zustand'
import type { RosterProblem } from './roster'
import type { BotActivity, RosterRowRef, RosterSnapshot, Selection } from './types'

export interface RosterState {
  snapshot: RosterSnapshot
  selection: Selection
  editingProfile: string | null
  activity: Record<string, BotActivity>
  // False while the engine socket is down: every bot shows as offline.
  online: boolean
  unread: Record<string, boolean>
  // By room id: a room and a bot may share an id.
  roomUnread: Record<string, boolean>
  // Each bot's chat activity time at the last snapshot, so a later move reads as a new reply.
  seen: Record<string, number>
  // Each room's newest log seq read, by the roster's poll or by the open room.
  roomSeen: Record<string, number>
  revision: number
  loading: boolean
  saving: boolean
  // A read of the roster failed: set and cleared by each poll or refresh.
  loadError: RosterProblem | null
  // The user's last change failed: kept until the next change, clearError, or opening or closing
  // the details, so a poll that succeeds does not wipe it from a dialog. Choosing another bot or
  // room clears it in the roster (not here: a selection made for the user must not hide it).
  actionError: RosterProblem | null
  // The rows picked to act on together (`itemKey`s, as picked), apart from the open chat; and the
  // row a Shift+click range starts from.
  picked: string[]
  pickAnchor: string | null
  select: (selection: Selection) => void
  editProfile: (profile: string | null) => void
  clearError: () => void
  setActivity: (profile: string, activity: BotActivity) => void
  setOnline: (online: boolean) => void
  markUnread: (profile: string) => void
  markRoomUnread: (roomId: string) => void
  seeRoom: (roomId: string, seq: number) => void
  pick: (picked: string[], anchor: string | null) => void
  markRead: (rows: RosterRowRef[]) => void
}

export const useRoster = create<RosterState>((set) => ({
  snapshot: { bots: [], folders: [], rooms: [], roomFolders: {}, roomPins: [], itemOrder: {} },
  selection: null,
  editingProfile: null,
  activity: {},
  online: true,
  unread: {},
  roomUnread: {},
  seen: {},
  roomSeen: {},
  revision: 0,
  loading: true,
  saving: false,
  loadError: null,
  actionError: null,
  picked: [],
  pickAnchor: null,
  select: (selection) =>
    set((state) => ({
      selection,
      editingProfile: null,
      unread: selection?.kind === 'bot' ? { ...state.unread, [selection.id]: false } : state.unread,
      roomUnread:
        selection?.kind === 'room'
          ? { ...state.roomUnread, [selection.id]: false }
          : state.roomUnread,
      seen: leftAt(state.selection, selection, state.seen)
    })),
  editProfile: (profile) => set({ editingProfile: profile, actionError: null }),
  clearError: () => set({ actionError: null }),
  setActivity: (profile, activity) =>
    set((state) => ({ activity: { ...state.activity, [profile]: activity } })),
  setOnline: (online) => set({ online }),
  markUnread: (profile) =>
    set((state) => ({
      unread: {
        ...state.unread,
        [profile]: !(state.selection?.kind === 'bot' && state.selection.id === profile)
      }
    })),
  markRoomUnread: (roomId) =>
    set((state) => ({
      roomUnread: {
        ...state.roomUnread,
        [roomId]: !(state.selection?.kind === 'room' && state.selection.id === roomId)
      }
    })),
  seeRoom: (roomId, seq) =>
    set((state) => ({
      roomSeen: { ...state.roomSeen, [roomId]: Math.max(state.roomSeen[roomId] ?? 0, seq) }
    })),
  pick: (picked, anchor) => set({ picked, pickAnchor: anchor }),
  markRead: (rows) =>
    set((state) => ({
      unread: { ...state.unread, ...read(rows, 'bot') },
      roomUnread: { ...state.roomUnread, ...read(rows, 'room') }
    }))
}))

function read(rows: RosterRowRef[], kind: RosterRowRef['kind']): Record<string, boolean> {
  return Object.fromEntries(rows.filter((row) => row.kind === kind).map((row) => [row.id, false]))
}

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
