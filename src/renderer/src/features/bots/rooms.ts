import { RosterError, botTitle } from './roster'
import type { Bot } from './types'

/** A bot as a room seats it: the handle you @ it by and the name the room shows. */
export interface RoomSeat {
  profile: string
  handle: string
  name: string
}

export interface RoomsBackend {
  /** The profiles the engine will seat in a new room; null when it does not say. */
  seatableProfiles: () => Promise<string[] | null>
  createRoom: (room: { roomId: string; name: string; seats: RoomSeat[] }) => Promise<void>
  /** Changes an existing room's bots in place (Talyx's engine plugin; the engine has no call). */
  setRoomMembers: (roomId: string, seats: RoomSeat[]) => Promise<void>
  renameRoom: (rename: { roomId: string; name: string }) => Promise<void>
}

// The engine seats two to six bots in a room.
export const MIN_ROOM_MEMBERS = 2
export const MAX_ROOM_MEMBERS = 6
// The handle you @ in the room to address Talyx (the default profile).
const MANAGER_HANDLE = 'talyx'

/** The profiles the engine will seat in a new room; null when it does not say. */
export function seatableProfiles(
  backend: Pick<RoomsBackend, 'seatableProfiles'>
): Promise<string[] | null> {
  return backend.seatableProfiles()
}

/** Create a hosted room with these bots; returns its id. */
export async function createRoom(
  backend: Pick<RoomsBackend, 'createRoom'>,
  room: { name: string; members: Bot[] }
): Promise<string> {
  const roomId = crypto.randomUUID()
  await backend.createRoom({ roomId, name: room.name.trim(), seats: seats(room.members) })
  return roomId
}

/**
 * Sets an existing room's bots: the same room, its id and history kept. A bot that joins answers
 * from the next turn and reads the room's history; one that leaves gets no more turns.
 */
export async function changeRoomMembers(
  backend: Pick<RoomsBackend, 'setRoomMembers'>,
  change: { roomId: string; members: Bot[] }
): Promise<void> {
  await backend.setRoomMembers(change.roomId, seats(change.members))
}

function seats(members: Bot[]): RoomSeat[] {
  if (members.length < MIN_ROOM_MEMBERS || members.length > MAX_ROOM_MEMBERS)
    throw new RosterError('rooms.errorMembers')
  return members.map((bot) => ({
    profile: bot.name,
    handle: roomHandle(bot.name),
    name: botTitle(bot)
  }))
}

/** Renames a room on the engine, for every client; the room's log records the new name. */
export async function renameRoom(
  backend: Pick<RoomsBackend, 'renameRoom'>,
  rename: { roomId: string; name: string }
): Promise<void> {
  const name = rename.name.trim()
  if (!name) throw new RosterError('rooms.errorName')
  await backend.renameRoom({ roomId: rename.roomId, name })
}

/** The handle a bot answers to when you @ it in a room Talyx made. */
export function roomHandle(profile: string): string {
  return profile === 'default' ? MANAGER_HANDLE : profile
}
