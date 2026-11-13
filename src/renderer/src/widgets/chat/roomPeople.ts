import { botTitle } from '@features/bots/roster'
import { roomHandle } from '@features/bots/rooms'
import type { Bot, Room } from '@features/bots/types'
import type { Mention } from '@features/chat/mentions'

// A member's name as the roster shows it. Never its handle: Talyx's handle in rooms made by
// other clients is not a name to show.
export function roomMember(
  room: Room,
  bots: Bot[],
  memberId: string
): { name: string; profile: string } {
  const member = room.members.find((item) => (item.member_id ?? item.profile) === memberId)
  const profile = member?.profile ?? memberId
  const bot = bots.find((item) => item.name === profile)
  return { name: bot ? botTitle(bot) : member?.display_name || profile, profile }
}

// What each member answers to: its handle (rooms other clients made may set their own), shown
// and written as its roster name.
export function roomMentions(
  room: Room,
  memberOf: (member: string) => { name: string; profile: string }
): Mention[] {
  return room.members.map((member) => ({
    handle: member.handle ?? roomHandle(member.profile),
    name: memberOf(member.member_id ?? member.profile).name
  }))
}
