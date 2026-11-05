import type { RosterState } from '@features/bots/store'
import { useRooms } from '@features/chat/roomStore'
import { useChat } from '@features/chat/store'

// A bot or room gone from the roster takes its chat or view along.
export function forgetDeleted(
  { snapshot }: RosterState,
  { snapshot: previous }: RosterState
): void {
  if (snapshot === previous) return
  const bots = new Set(snapshot.bots.map((bot) => bot.name))
  const rooms = new Set(snapshot.rooms.map((room) => room.room_id))
  const goneBots = previous.bots.map((bot) => bot.name).filter((name) => !bots.has(name))
  const goneRooms = previous.rooms.map((room) => room.room_id).filter((id) => !rooms.has(id))
  if (goneBots.length > 0) useChat.getState().forget(goneBots)
  if (goneRooms.length > 0) useRooms.getState().forget(goneRooms)
}
