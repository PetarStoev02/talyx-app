import { create } from 'zustand'
import type { RoomView } from './types'

interface RoomStore {
  // One view per room, keyed by room id.
  rooms: Record<string, RoomView>
  update: (roomId: string, change: Partial<RoomView>) => void
}

const blank = (): RoomView => ({
  events: [],
  lastSeq: 0,
  live: false,
  working: false,
  phases: {},
  tasks: [],
  failedSend: null,
  loading: true,
  error: null
})

export const useRooms = create<RoomStore>((set) => ({
  rooms: {},
  update: (roomId, change) =>
    set((state) => ({
      rooms: { ...state.rooms, [roomId]: { ...(state.rooms[roomId] ?? blank()), ...change } }
    }))
}))
