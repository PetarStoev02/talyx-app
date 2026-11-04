import { BotAvatar } from './BotAvatar'
import type { Bot, Room } from './types'

// A room shows up to three of its members side by side.
const SHOWN = 3

export function RoomAvatars({
  room,
  bots,
  size = 24
}: {
  room: Room
  bots: Bot[]
  size?: number
}): React.JSX.Element {
  return (
    <span className="flex shrink-0 -space-x-3" aria-hidden="true">
      {room.members.slice(0, SHOWN).map((member) => (
        <span key={member.profile} className="rounded-full bg-sidebar">
          <BotAvatar
            bot={
              bots.find((bot) => bot.name === member.profile) ?? { name: member.profile, meta: {} }
            }
            size={size}
          />
        </span>
      ))}
    </span>
  )
}
