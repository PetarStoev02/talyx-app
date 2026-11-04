import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { folderBots, isWithin } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import { useLanguage } from '@app/providers/useLanguage'
import type { Bot, Folder, Room } from '@features/bots/types'
import { BotAvatar, BotRow } from './BotRow'
import { ROSTER_DRAG } from './rosterControls'
import { RosterMenu } from './RosterMenu'
import type { MenuAction } from './RosterMenu'

export interface FolderGroupProps {
  folder: Folder | null
  botActions: (bot: Bot) => MenuAction[]
  folderActions: (folder: Folder) => MenuAction[]
  selectBot: (bot: Bot) => void
  selectRoom: (room: Room) => void
  moveRoom: (room: Room, folderId: string | null) => void
  dropOnFolder: (data: string, folderId: string | null) => void
}

export function FolderGroup(props: FolderGroupProps): React.JSX.Element {
  const { folder, botActions, folderActions, selectBot, selectRoom, dropOnFolder } = props
  const t = useLanguage((s) => s.t)
  const [collapsed, setCollapsed] = useState(false)
  const snapshot = useRoster((state) => state.snapshot)
  const saving = useRoster((state) => state.saving)
  const id = folder?.id ?? null
  const bots = folderBots(snapshot, id)
  const rooms = snapshot.rooms.filter((room) => {
    const assigned = snapshot.roomFolders[room.room_id]
    return (snapshot.folders.some((item) => item.id === assigned) ? assigned : null) === id
  })
  const children = snapshot.folders.filter((item) => item.parentId === id)
  const descendants = folder
    ? snapshot.folders.filter((item) => isWithin(snapshot.folders, item.id, folder.id))
    : []
  const count = folder
    ? descendants.reduce((total, item) => total + folderBots(snapshot, item.id).length, 0)
    : bots.length
  return (
    <section
      aria-label={folder?.name ?? t('roster.unassigned')}
      className="min-w-0 py-2"
      onDragOver={(event) => {
        if (!saving && event.dataTransfer.types.includes(ROSTER_DRAG)) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (!saving) dropOnFolder(event.dataTransfer.getData(ROSTER_DRAG), id)
      }}
    >
      <div
        className="flex items-center"
        draggable={!!folder && !saving}
        onDragStart={(event) => {
          if (folder) {
            event.stopPropagation()
            event.dataTransfer.setData(
              ROSTER_DRAG,
              JSON.stringify({ kind: 'folder', id: folder.id })
            )
          }
        }}
      >
        <button
          className="flex min-w-0 flex-1 items-center gap-2 rounded-full px-2 py-2 text-left text-base font-medium hover:bg-accent"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          <span className="truncate">{folder?.name ?? t('roster.unassigned')}</span>
          <span className="ml-auto tabular-nums">{count}</span>
        </button>
        {folder && (
          <RosterMenu
            label={t('roster.folderActionsFor').replace('{name}', folder.name)}
            actions={folderActions(folder)}
            disabled={saving}
          />
        )}
      </div>
      {!collapsed && (
        <div className="space-y-1">
          {bots.map((bot) => (
            <BotRow
              key={bot.name}
              bot={bot}
              actions={botActions(bot)}
              onSelect={() => selectBot(bot)}
            />
          ))}
          {rooms.map((room) => (
            <RoomRow
              key={room.room_id}
              room={room}
              folderId={id}
              onSelect={() => selectRoom(room)}
              onMove={(folderId) => props.moveRoom(room, folderId)}
            />
          ))}
          {children.map((child) => (
            <div className="pl-3" key={child.id}>
              <FolderGroup {...props} folder={child} />
            </div>
          ))}
          {bots.length + rooms.length + children.length === 0 && (
            <p className="px-3 py-2 text-base">{t('roster.emptyFolder')}</p>
          )}
        </div>
      )}
    </section>
  )
}

function RoomRow({
  room,
  folderId,
  onSelect,
  onMove
}: {
  room: Room
  folderId: string | null
  onSelect: () => void
  onMove: (folderId: string | null) => void
}): React.JSX.Element {
  const selected = useRoster(
    (state) => state.selection?.kind === 'room' && state.selection.id === room.room_id
  )
  const folders = useRoster((state) => state.snapshot.folders)
  const bots = useRoster((state) => state.snapshot.bots)
  const saving = useRoster((state) => state.saving)
  const t = useLanguage((s) => s.t)
  return (
    <div
      className="flex rounded-xl hover:bg-accent"
      draggable={!saving}
      onDragStart={(event) =>
        event.dataTransfer.setData(ROSTER_DRAG, JSON.stringify({ kind: 'room', id: room.room_id }))
      }
    >
      <button
        onClick={onSelect}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left aria-pressed:bg-accent"
      >
        <span className="flex shrink-0 -space-x-3" aria-hidden="true">
          {room.members.slice(0, 3).map((member) => (
            <span key={member.profile} className="rounded-full bg-sidebar">
              <BotAvatar
                bot={bots.find((bot) => bot.name === member.profile) ?? { name: member.profile }}
              />
            </span>
          ))}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base font-medium">{room.name}</span>
          <span className="block text-base">
            {room.members.length === 1
              ? t('roster.oneBot')
              : t('roster.bots').replace('{count}', String(room.members.length))}
          </span>
        </span>
      </button>
      <RosterMenu
        label={t('roster.actionsFor').replace('{name}', room.name)}
        disabled={saving}
        actions={[{ id: null, name: t('roster.unassigned') }, ...folders]
          .filter((folder) => folder.id !== folderId)
          .map((folder) => ({
            label: t('roster.moveTo').replace('{name}', folder.name),
            onSelect: () => onMove(folder.id)
          }))}
      />
    </div>
  )
}
