import { cn } from '@shared/lib/utils'
import { useLanguage } from '@app/providers/useLanguage'
import { botActivityTime, botPreview, botTitle, timeInWords } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import { BotAvatar } from '@features/bots/BotAvatar'
import type { Bot } from '@features/bots/types'
import { RosterMenu } from './RosterMenu'
import { ROSTER_DRAG, readRosterDrag } from './rosterControls'
import type { MenuAction } from './RosterMenu'

export function BotRow({
  bot,
  actions,
  pinned = false,
  onSelect,
  onDropPin,
  avatarSize = 44
}: {
  bot: Bot
  actions: MenuAction[]
  pinned?: boolean
  avatarSize?: number
  onSelect: () => void
  onDropPin?: (from: string) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const selected = useRoster(
    (state) => state.selection?.kind === 'bot' && state.selection.id === bot.name
  )
  const unread = useRoster((state) => state.unread[bot.name])
  const activity = useRoster((state) => state.activity[bot.name] ?? 'idle')
  const saving = useRoster((state) => state.saving)
  const preview = botPreview(bot) || t('roster.noMessages')
  const status =
    activity === 'waiting'
      ? t('roster.statusWaiting')
      : activity === 'working'
        ? t('roster.statusWorking')
        : unread
          ? t('roster.statusUnread')
          : ''
  return (
    <div
      draggable={!saving}
      onDragStart={(event) =>
        event.dataTransfer.setData(ROSTER_DRAG, JSON.stringify({ kind: 'bot', id: bot.name }))
      }
      onDragOver={(event) => {
        if (pinned && event.dataTransfer.types.includes(ROSTER_DRAG)) event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        const item = readRosterDrag(event.dataTransfer.getData(ROSTER_DRAG))
        if (item?.kind === 'bot') onDropPin?.(item.id)
      }}
      className={cn(
        'group flex min-w-0 rounded-xl',
        selected && 'bg-accent',
        pinned && 'relative flex-col bg-secondary'
      )}
    >
      <button
        onClick={onSelect}
        aria-pressed={selected}
        aria-description={status || undefined}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left hover:bg-accent',
          pinned && 'flex-col px-1 pt-8 text-center'
        )}
      >
        <BotAvatar bot={bot} size={pinned ? avatarSize : 24} />
        <span className="min-w-0 flex-1" title={botTitle(bot)}>
          <span className={cn('flex items-baseline gap-2', pinned && 'justify-center')}>
            <span className="truncate text-base font-medium">{botTitle(bot)}</span>
            {!pinned && (
              <span className="ml-auto shrink-0 text-xs">
                {timeInWords(botActivityTime(bot), t)}
              </span>
            )}
          </span>
          <span className="block truncate text-base" title={status || preview}>
            {pinned ? status || t('roster.statusReady') : preview}
          </span>
        </span>
        {(unread || activity === 'waiting') && (
          <span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
        )}
      </button>
      <RosterMenu
        compact={pinned}
        label={t('roster.actionsFor').replace('{name}', botTitle(bot))}
        actions={actions}
        disabled={saving}
      />
    </div>
  )
}
