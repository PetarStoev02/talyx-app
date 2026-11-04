import { useLanguage } from '@app/providers/useLanguage'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { ChatItem } from '@features/chat/types'

type ToolItem = Extract<ChatItem, { kind: 'tool' }>

/** One quiet line per tool call; a `message_agent` call names the bot it asked. */
export function ToolLine({ tool }: { tool: ToolItem }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const target = useRoster((state) =>
    tool.target ? state.snapshot.bots.find((bot) => bot.name === tool.target) : undefined
  )
  const text = tool.target
    ? `↳ ${t('chat.asked').replace('{name}', target ? botTitle(target) : tool.target)}`
    : t(tool.done ? 'chat.toolRan' : 'chat.toolRunning').replace('{name}', tool.label)
  const seconds =
    tool.seconds === null
      ? ''
      : ` · ${t('chat.toolSeconds').replace('{seconds}', String(Math.max(1, Math.round(tool.seconds))))}`
  return (
    <p className="text-sm text-muted-foreground">
      {text}
      {seconds}
    </p>
  )
}
