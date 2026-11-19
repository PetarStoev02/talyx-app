import { pinnedBots, pinnedRooms } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Bot, Room } from '@features/bots/types'
import { BotRow } from './BotRow'
import { RoomRow } from './RoomRow'
import type { MenuAction } from './RosterMenu'

// The gap between pinned tiles, also counted in each tile's width so a full row fits.
const PIN_GAP = '0.5rem'

// Up to three pins show as large tiles; a fourth switches to four small ones a row. Pinned bots
// come first, then pinned rooms; a row that is not full is centered.
export function PinnedGrid({
  botActions,
  roomActions,
  selectBot,
  selectRoom,
  orderPin
}: {
  botActions: (bot: Bot) => MenuAction[]
  roomActions: (room: Room) => MenuAction[]
  selectBot: (bot: Bot) => void
  selectRoom: (room: Room) => void
  orderPin: (from: string, to: string) => void
}): React.JSX.Element {
  const snapshot = useRoster((state) => state.snapshot)
  const pins = pinnedBots(snapshot.bots)
  const rooms = pinnedRooms(snapshot)
  const large = pins.length + rooms.length <= 3
  const tile = large ? `calc((100% - 2 * ${PIN_GAP}) / 3)` : `calc((100% - 3 * ${PIN_GAP}) / 4)`
  return (
    <div
      className="flex flex-wrap justify-center gap-(--gap) [&>*]:w-(--tile)"
      style={{ '--tile': tile, '--gap': PIN_GAP } as React.CSSProperties}
    >
      {pins.map((bot) => (
        <div key={bot.name} data-flip={`bot:${bot.name}`}>
          <BotRow
            bot={bot}
            pinned
            avatarSize={large ? 44 : 32}
            actions={() => botActions(bot)}
            onSelect={() => selectBot(bot)}
            onDropPin={(from) => orderPin(from, bot.name)}
          />
        </div>
      ))}
      {rooms.map((room) => (
        <div key={room.room_id} data-flip={`room:${room.room_id}`}>
          <RoomRow
            room={room}
            pinned
            avatarSize={large ? 44 : 32}
            actions={() => roomActions(room)}
            onSelect={() => selectRoom(room)}
          />
        </div>
      ))}
    </div>
  )
}
