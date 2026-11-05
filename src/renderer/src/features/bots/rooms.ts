import type { RosterBackend } from './data'
import { RosterError, botTitle } from './roster'
import type { Bot } from './types'

// The engine seats two to six bots in a room.
export const MIN_ROOM_MEMBERS = 2
export const MAX_ROOM_MEMBERS = 6
// The handle you @ in the room to address Talyx (the default profile).
const MANAGER_HANDLE = 'talyx'

/** The profiles the engine will seat in a new room; null when it does not say. */
export async function seatableProfiles(backend: RosterBackend): Promise<string[] | null> {
  const { seatable_profiles: seatable } = (await backend.request(
    'default',
    'groups.capabilities',
    {}
  )) as { seatable_profiles?: string[] | null }
  return Array.isArray(seatable) ? seatable : null
}

/** Create a hosted room with these bots; returns its id. */
export async function createRoom(
  backend: RosterBackend,
  room: { name: string; members: Bot[] }
): Promise<string> {
  const { members } = room
  if (members.length < MIN_ROOM_MEMBERS || members.length > MAX_ROOM_MEMBERS)
    throw new RosterError('rooms.errorMembers')
  const roomId = crypto.randomUUID()
  await backend.request('default', 'groups.create', {
    room_id: roomId,
    name: room.name.trim(),
    members: members.map((bot) => ({
      member_id: bot.name,
      profile: bot.name,
      handle: roomHandle(bot.name),
      display_name: botTitle(bot),
      target: { kind: 'local', profile: bot.name }
    }))
  })
  return roomId
}

/** The handle a bot answers to when you @ it in a room Talyx made. */
export function roomHandle(profile: string): string {
  return profile === 'default' ? MANAGER_HANDLE : profile
}
