import { useTurnToCursor } from '@shared/hooks/useTurnToCursor'
import { BlockAvatar } from '@shared/ui/BlockAvatar'
import type { BlockState } from '@contract/moduleHost'
import { lookOf } from './look'
import { useRoster } from './store'
import type { Bot } from './types'

/**
 * Where an avatar sits decides how it moves: a row is still, a pinned tile blinks and bobs while
 * working, the name pill is still, and the details hero also turns toward the cursor.
 */
export type AvatarPlace = 'row' | 'tile' | 'pill' | 'hero'

const SIZES: Record<AvatarPlace, number> = { row: 24, tile: 44, pill: 20, hero: 64 }
const ANIMATED: AvatarPlace[] = ['tile', 'hero']

export function BotAvatar({
  bot,
  place,
  size = SIZES[place],
  speaking = false
}: {
  bot: Bot
  place: AvatarPlace
  size?: number
  // Answering right now (typing in a chat, speaking in a room): the block bobs wherever it is.
  speaking?: boolean
}): React.JSX.Element {
  const activity = useRoster((state) => state.activity[bot.name] ?? 'idle')
  const online = useRoster((state) => state.online)
  const [anchor, yaw] = useTurnToCursor(place === 'hero')
  const look = lookOf(bot)
  const state: BlockState = !online ? 'offline' : speaking ? 'working' : activity
  return (
    <span ref={anchor} className="inline-flex shrink-0">
      <BlockAvatar
        shape={bot.name === 'default' ? 'talyx' : look.shape}
        hue={look.hue}
        size={size}
        state={state}
        face={look.faces}
        animated={speaking || ANIMATED.includes(place)}
        yaw={yaw}
      />
    </span>
  )
}
