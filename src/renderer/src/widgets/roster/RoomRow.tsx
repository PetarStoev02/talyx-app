import { cn } from '@shared/lib/utils'
import { ContextMenuArea } from '@shared/ui/menu'
import { OverflowTooltip } from '@shared/ui/tooltip'
import { useLanguage } from '@app/providers/useLanguage'
import { RoomAvatars } from '@features/bots/RoomAvatars'
import { itemKey } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Room } from '@features/bots/types'
import { endRosterDrag, startRosterDrag } from './drag'
import { clickRow } from './picks'
import type { MenuAction } from '@shared/ui/menu'

// A row's avatar square: a bot's block, and a room's members clustered, in the same box.
export const ROW_AVATAR_BOX = 28

/** A room in a folder, or as a tile beside the pinned bots. */
export function RoomRow({
  room,
  actions,
  onSelect,
  pinned = false,
  avatarSize = 44
}: {
  room: Room
  actions: () => MenuAction[]
  onSelect: () => void
  pinned?: boolean
  // The pinned bots' avatar size, so a room tile lines up with theirs.
  avatarSize?: number
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const selected = useRoster(
    (state) => state.selection?.kind === 'room' && state.selection.id === room.room_id
  )
  const row = { kind: 'room' as const, id: room.room_id }
  const picked = useRoster((state) => state.picked.includes(itemKey(row)))
  const bots = useRoster((state) => state.snapshot.bots)
  const unread = useRoster((state) => state.roomUnread[room.room_id])
  const saving = useRoster((state) => state.saving)
  const count =
    room.members.length === 1
      ? t('roster.oneBot')
      : t('roster.bots').replace('{count}', String(room.members.length))
  return (
    // Right-click (or Shift+F10) opens the row's or tile's actions.
    <ContextMenuArea actions={actions} disabled={saving}>
      <div
        // The same row as a bot's: the selection on the row, the hover on its button.
        className={cn(
          'flex min-w-0 rounded-xl',
          pinned && 'relative flex-col bg-secondary',
          selected && 'bg-foreground/10',
          picked && 'bg-brand/15'
        )}
        draggable={!saving}
        data-roster-row={itemKey(row)}
        onDragStart={(event) => startRosterDrag(event, row)}
        onDragEnd={endRosterDrag}
      >
        <OverflowTooltip text={room.name}>
          <button
            onClick={(event) => clickRow(event, row, onSelect)}
            aria-current={selected || undefined}
            aria-description={
              [picked && t('roster.pickedRow'), unread && t('roster.statusNewMessages')]
                .filter(Boolean)
                .join(', ') || undefined
            }
            className={cn(
              'flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left',
              !selected && !picked && 'hover:bg-accent',
              pinned && 'flex-col px-1 pt-5 pb-3 text-center'
            )}
          >
            {/* The members share one avatar's square, so a room lines up with the bots. */}
            <RoomAvatars room={room} bots={bots} cluster={pinned ? avatarSize : ROW_AVATAR_BOX} />
            <span className={cn('min-w-0 flex-1', pinned && 'w-full')}>
              <span
                className={cn(
                  'block truncate',
                  pinned ? 'text-sm' : 'text-base',
                  selected ? 'font-semibold' : 'font-medium'
                )}
              >
                {room.name}
              </span>
              <span
                className={cn(
                  'block truncate text-muted-foreground',
                  pinned ? 'text-xs' : 'text-sm'
                )}
              >
                {pinned && unread ? t('roster.statusNewMessages') : count}
              </span>
            </span>
            {unread &&
              (pinned ? (
                // In the tile's corner, so a tile with a dot is as tall as the others.
                <span className="absolute top-2.5 right-2.5 flex">
                  <UnreadDot />
                </span>
              ) : (
                <UnreadDot />
              ))}
          </button>
        </OverflowTooltip>
      </div>
    </ContextMenuArea>
  )
}

export function UnreadDot(): React.JSX.Element {
  return <span className="block-fade size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
}
