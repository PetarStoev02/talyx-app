import { cn } from '@shared/lib/utils'
import { useLanguage } from '@app/providers/useLanguage'
import { RoomAvatars } from '@features/bots/RoomAvatars'
import { useRoster } from '@features/bots/store'
import type { Room } from '@features/bots/types'
import { RosterMenu } from './RosterMenu'
import { ROSTER_DRAG } from './rosterControls'
import type { MenuAction } from './RosterMenu'

// Three member avatars overlap; at this share of a bot tile's avatar they fit one tile's width.
const PINNED_AVATAR_SHARE = 0.6

/** A room in a folder, or as a tile beside the pinned bots. */
export function RoomRow({
  room,
  actions,
  onSelect,
  pinned = false,
  avatarSize = 44
}: {
  room: Room
  actions: MenuAction[]
  onSelect: () => void
  pinned?: boolean
  // The pinned bots' avatar size, so a room tile lines up with theirs.
  avatarSize?: number
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const selected = useRoster(
    (state) => state.selection?.kind === 'room' && state.selection.id === room.room_id
  )
  const bots = useRoster((state) => state.snapshot.bots)
  const unread = useRoster((state) => state.roomUnread[room.room_id])
  const saving = useRoster((state) => state.saving)
  const count =
    room.members.length === 1
      ? t('roster.oneBot')
      : t('roster.bots').replace('{count}', String(room.members.length))
  return (
    <div
      className={cn(
        'flex min-w-0 rounded-xl hover:bg-accent',
        pinned && 'relative flex-col bg-secondary'
      )}
      draggable={!saving}
      onDragStart={(event) =>
        event.dataTransfer.setData(ROSTER_DRAG, JSON.stringify({ kind: 'room', id: room.room_id }))
      }
    >
      <button
        onClick={onSelect}
        aria-pressed={selected}
        aria-description={unread ? t('roster.statusNewMessages') : undefined}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left aria-pressed:bg-accent',
          pinned && 'flex-col px-1 pt-8 text-center'
        )}
      >
        {pinned ? (
          <span className="flex items-center" style={{ height: avatarSize }}>
            <RoomAvatars
              room={room}
              bots={bots}
              size={Math.round(avatarSize * PINNED_AVATAR_SHARE)}
            />
          </span>
        ) : (
          <RoomAvatars room={room} bots={bots} />
        )}
        <span className={cn('min-w-0 flex-1', pinned && 'w-full')} title={room.name}>
          <span className="block truncate text-base font-medium">{room.name}</span>
          <span className="block truncate text-base">
            {pinned && unread ? t('roster.statusNewMessages') : count}
          </span>
        </span>
        {unread && <span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />}
      </button>
      <RosterMenu
        compact={pinned}
        label={t('roster.actionsFor').replace('{name}', room.name)}
        disabled={saving}
        actions={actions}
      />
    </div>
  )
}
