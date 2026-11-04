import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { folderBots, folderCount, folderRooms } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import { useLanguage } from '@app/providers/useLanguage'
import type { Bot, Folder, Room } from '@features/bots/types'
import { BotRow } from './BotRow'
import { RoomRow } from './RoomRow'
import { ROSTER_DRAG } from './rosterControls'
import { RosterMenu } from './RosterMenu'
import type { MenuAction } from './RosterMenu'

export interface FolderGroupProps {
  folder: Folder | null
  botActions: (bot: Bot) => MenuAction[]
  folderActions: (folder: Folder) => MenuAction[]
  selectBot: (bot: Bot) => void
  selectRoom: (room: Room) => void
  roomActions: (room: Room) => MenuAction[]
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
  const rooms = folderRooms(snapshot, id)
  const children = snapshot.folders.filter((item) => item.parentId === id)
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
      <FolderHeader
        folder={folder}
        collapsed={collapsed}
        toggle={() => setCollapsed(!collapsed)}
        folderActions={folderActions}
      />
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
              actions={props.roomActions(room)}
              onSelect={() => selectRoom(room)}
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

function FolderHeader({
  folder,
  collapsed,
  toggle,
  folderActions
}: {
  folder: Folder | null
  collapsed: boolean
  toggle: () => void
  folderActions: (folder: Folder) => MenuAction[]
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const snapshot = useRoster((state) => state.snapshot)
  const saving = useRoster((state) => state.saving)
  return (
    <div
      className="flex items-center"
      draggable={!!folder && !saving}
      onDragStart={(event) => {
        if (folder) {
          event.stopPropagation()
          event.dataTransfer.setData(ROSTER_DRAG, JSON.stringify({ kind: 'folder', id: folder.id }))
        }
      }}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-2 rounded-full px-2 py-2 text-left text-base font-medium hover:bg-accent"
        aria-expanded={!collapsed}
        onClick={toggle}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        <span className="truncate">{folder?.name ?? t('roster.unassigned')}</span>
        <span className="ml-auto tabular-nums">{folderCount(snapshot, folder?.id ?? null)}</span>
      </button>
      {folder ? (
        <RosterMenu
          label={t('roster.folderActionsFor').replace('{name}', folder.name)}
          actions={folderActions(folder)}
          disabled={saving}
        />
      ) : (
        // Unassigned has no menu; the gap keeps its count in line with the folders above.
        <span className="size-8 shrink-0" aria-hidden="true" />
      )}
    </div>
  )
}
