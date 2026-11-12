import { useEffect, useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { BotAvatar } from '@features/bots/BotAvatar'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Bot } from '@features/bots/types'
import { waitLeft } from '@features/chat/transcript'
import type { TurnActivity } from '@features/chat/turns'

const SECOND_MS = 1000

/**
 * The one line a working bot shows: its newest tool (or the engine's notice while it waits on a
 * provider, its retry counted down), how many it ran and how long the turn has taken, updated in
 * place. It mounts when the turn starts, so the clock counts from then.
 */
export function ActivityLine({
  bot,
  activity,
  wait
}: {
  bot: Bot
  activity: TurnActivity
  wait: string | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [started] = useState(() => Date.now())
  const [now, setNow] = useState(started)
  // When the current wait notice came in: its retry time counts from then.
  const [waited, setWaited] = useState({ wait, since: started })
  if (waited.wait !== wait) setWaited({ wait, since: Date.now() })
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), SECOND_MS)
    return () => clearInterval(timer)
  }, [])
  const { tool, tools } = activity
  const target = useRoster((state) =>
    tool?.target ? state.snapshot.bots.find((each) => each.name === tool.target) : undefined
  )
  const doing = wait
    ? waitLeft(wait, Math.max(0, now - waited.since), (seconds) =>
        t('chat.waitRetryIn').replace('{time}', duration(seconds))
      )
    : !tool
      ? t('chat.typing').replace('{name}', botTitle(bot))
      : tool.target
        ? t('chat.asking').replace('{name}', target ? botTitle(target) : tool.target)
        : tool.label
  const count = tools === 1 ? t('chat.toolSoFar') : t('chat.toolsSoFar')
  const parts = [
    doing,
    tools ? count.replace('{count}', String(tools)) : null,
    duration(Math.floor((now - started) / SECOND_MS))
  ]
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <BotAvatar bot={bot} place="row" speaking />
      <span className="min-w-0 truncate">{parts.filter(Boolean).join(' · ')}</span>
    </p>
  )

  function duration(seconds: number): string {
    return seconds < 60
      ? t('chat.toolSeconds').replace('{seconds}', String(seconds))
      : t('chat.elapsedMinutes')
          .replace('{minutes}', String(Math.floor(seconds / 60)))
          .replace('{seconds}', String(seconds % 60))
  }
}
