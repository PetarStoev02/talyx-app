import { useEffect, useRef, useState } from 'react'
import { BlockAvatar } from '@shared/ui/BlockAvatar'
import type { BlockState } from '@shared/ui/BlockAvatar'
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
// The hero turns at most this many degrees, easing over TURN_MS.
const MAX_TURN = 8
const TURN_MS = 200

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

// Eases toward a few degrees left or right of the cursor; still under reduced motion.
function useTurnToCursor(enabled: boolean): [React.RefObject<HTMLSpanElement | null>, number] {
  const anchor = useRef<HTMLSpanElement>(null)
  const [yaw, setYaw] = useState(0)
  useEffect(() => {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let target = 0
    let current = 0
    let frame = 0
    let last = 0
    const step = (time: number): void => {
      current += (target - current) * Math.min(1, (time - last) / TURN_MS)
      last = time
      setYaw(current)
      frame = Math.abs(target - current) > 0.05 ? requestAnimationFrame(step) : 0
    }
    const follow = (event: PointerEvent): void => {
      const box = anchor.current?.getBoundingClientRect()
      if (!box) return
      const offset = (event.clientX - (box.left + box.width / 2)) / (window.innerWidth / 2)
      target = Math.max(-1, Math.min(1, offset)) * MAX_TURN
      if (frame) return
      last = performance.now()
      frame = requestAnimationFrame(step)
    }
    window.addEventListener('pointermove', follow)
    return () => {
      window.removeEventListener('pointermove', follow)
      cancelAnimationFrame(frame)
    }
  }, [enabled])
  return [anchor, yaw]
}
