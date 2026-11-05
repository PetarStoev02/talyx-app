import { create } from 'zustand'
import type { RoomView } from './types'

interface RoomStore {
  // One view per room, keyed by room id.
  rooms: Record<string, RoomView>
  update: (roomId: string, change: Partial<RoomView>) => void
  /** Drops the views of deleted rooms. */
  forget: (roomIds: string[]) => void
}

const blank = (): RoomView => ({
  events: [],
  models: [],
  lastSeq: 0,
  live: false,
  working: false,
  phases: {},
  tasks: [],
  failedSend: null,
  loading: true,
  error: null,
  actionError: null
})

export const useRooms = create<RoomStore>((set) => ({
  rooms: {},
  update: (roomId, change) =>
    set((state) => ({
      rooms: { ...state.rooms, [roomId]: { ...(state.rooms[roomId] ?? blank()), ...change } }
    })),
  forget: (roomIds) =>
    set((state) => ({
      rooms: Object.fromEntries(
        Object.entries(state.rooms).filter(([roomId]) => !roomIds.includes(roomId))
      )
    }))
}))
