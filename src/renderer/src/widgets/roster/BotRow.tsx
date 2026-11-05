import { cn } from '@shared/lib/utils'
import { ContextMenuArea } from '@shared/ui/menu'
import { OverflowTooltip } from '@shared/ui/tooltip'
import { useLanguage } from '@app/providers/useLanguage'
import { botActivityTime, botPreview, botTitle, timeInWords } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import { BotAvatar } from '@features/bots/BotAvatar'
import type { Bot } from '@features/bots/types'
import { ROSTER_DRAG, draggedItem, endRosterDrag, startRosterDrag } from './drag'
import type { MenuAction } from '@shared/ui/menu'
import { ROW_AVATAR_BOX } from './RoomRow'

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
    // Right-click (or Shift+F10) opens the row's or tile's actions.
    <ContextMenuArea actions={actions} disabled={saving}>
      <div
        draggable={!saving}
        onDragStart={(event) => startRosterDrag(event, { kind: 'bot', id: bot.name })}
        onDragEnd={endRosterDrag}
        onDragOver={(event) => {
          if (pinned && event.dataTransfer.types.includes(ROSTER_DRAG)) event.preventDefault()
        }}
        onDrop={(event) => {
          if (!pinned) return
          event.preventDefault()
          event.stopPropagation()
          const item = draggedItem()
          endRosterDrag()
          if (item?.kind === 'bot') onDropPin?.(item.id)
        }}
        className={cn(
          'group flex min-w-0 rounded-xl',
          pinned && 'relative flex-col bg-secondary',
          // After the tile's tone step, so a selected pinned bot still shows it is selected.
          selected && 'bg-foreground/10'
        )}
      >
        <OverflowTooltip text={botTitle(bot)}>
          <button
            onClick={onSelect}
            aria-current={selected || undefined}
            aria-description={status || undefined}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left',
              !selected && 'hover:bg-accent',
              pinned && 'flex-col px-1 pt-5 pb-3 text-center'
            )}
          >
            {pinned ? (
              <span className="transition-transform group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                <BotAvatar bot={bot} place="tile" size={avatarSize} />
              </span>
            ) : (
              <span
                className="flex shrink-0 items-center justify-center"
                style={{ width: ROW_AVATAR_BOX, height: ROW_AVATAR_BOX }}
              >
                <BotAvatar bot={bot} place="row" />
              </span>
            )}
            {/* In a tile the column would grow to the name; the full width lets it truncate. */}
            <span className={cn('min-w-0 flex-1', pinned && 'w-full')}>
              <span className={cn('flex items-baseline gap-2', pinned && 'justify-center')}>
                <span
                  className={cn('truncate text-base', selected ? 'font-semibold' : 'font-medium')}
                >
                  {botTitle(bot)}
                </span>
                {!pinned && (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {timeInWords(botActivityTime(bot), t)}
                  </span>
                )}
              </span>
              <span className="block truncate text-sm text-muted-foreground">
                {pinned ? status || t('roster.statusReady') : preview}
              </span>
            </span>
            {(unread || activity === 'waiting') && (
              <span
                className="block-fade size-2 shrink-0 rounded-full bg-brand"
                aria-hidden="true"
              />
            )}
          </button>
        </OverflowTooltip>
      </div>
    </ContextMenuArea>
  )
}
