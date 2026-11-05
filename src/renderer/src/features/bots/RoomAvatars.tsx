import { BotAvatar } from './BotAvatar'
import type { Bot, Room } from './types'

// A room shows up to three of its members side by side.
const SHOWN = 3

export function RoomAvatars({
  room,
  bots,
  size = 24,
  speaking = []
}: {
  room: Room
  bots: Bot[]
  size?: number
  // Profiles answering in the open room; their blocks bob.
  speaking?: string[]
}): React.JSX.Element {
  return (
    <span className="flex shrink-0 items-end -space-x-1" aria-hidden="true">
      {room.members.slice(0, SHOWN).map((member) => (
        <BotAvatar
          key={member.profile}
          bot={
            bots.find((bot) => bot.name === member.profile) ?? { name: member.profile, meta: {} }
          }
          place="row"
          size={size}
          speaking={speaking.includes(member.profile)}
        />
      ))}
    </span>
  )
}
