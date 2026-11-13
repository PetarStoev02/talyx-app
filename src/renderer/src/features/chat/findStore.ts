import { create } from 'zustand'
import { samePlace } from './botSearch'
import type { SearchPlace } from './botSearch'

/** A find to open in a chat or room: the words, and the message to start at (none: the first). */
export interface FindRequest {
  place: SearchPlace
  query: string
  messageId: string | null
}

interface FindStore {
  request: FindRequest | null
  ask: (request: FindRequest) => void
  clear: () => void
}

/** The find a bot's chat or a room opens: from its search button, ⌘F, or a hit picked elsewhere. */
export const useFind = create<FindStore>((set) => ({
  request: null,
  ask: (request) => set({ request }),
  clear: () => set({ request: null })
}))

/** The find open in this place, or none. */
export function findIn(request: FindRequest | null, place: SearchPlace): FindRequest | null {
  return request && samePlace(request.place, place) ? request : null
}
