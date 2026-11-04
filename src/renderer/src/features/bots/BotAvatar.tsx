import { Box } from 'lucide-react'
import { TalyxLogo } from '@shared/ui/TalyxLogo'
import type { Bot } from './types'

// Blocks replace the box in the avatars update; the manager is always the logo.
export function BotAvatar({ bot, size = 24 }: { bot: Bot; size?: number }): React.JSX.Element {
  return bot.name === 'default' ? (
    <TalyxLogo size={size} className="shrink-0" />
  ) : (
    <Box size={size} aria-hidden="true" className="shrink-0" strokeWidth={1.5} />
  )
}
