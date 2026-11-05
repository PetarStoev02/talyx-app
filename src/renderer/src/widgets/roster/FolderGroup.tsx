import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { folderCount, folderItems, isWithin, itemKey, itemRef } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import { useLanguage } from '@app/providers/useLanguage'
import type { Bot, Folder, Room } from '@features/bots/types'
import { OverflowTooltip } from '@shared/ui/tooltip'
import { BotRow } from './BotRow'
import { DropSlot } from './DropSlot'
import type { DropEdge } from './DropSlot'
import { draggedItem, endRosterDrag, startRosterDrag } from './drag'
import type { RosterDragItem } from './drag'
import { RoomRow } from './RoomRow'
import type { RosterDrops } from './rosterControls'
import { ContextMenuArea } from '@shared/ui/menu'
import type { MenuAction } from '@shared/ui/menu'
import { Button } from '@shared/ui/button'
import { useCreating } from './creating'
import { RosterMenu } from './RosterMenu'

export interface FolderGroupProps {
  folder: Folder | null
  botActions: (bot: Bot) => MenuAction[]
  folderActions: (folder: Folder) => MenuAction[]
  selectBot: (bot: Bot) => void
  selectRoom: (room: Room) => void
  roomActions: (room: Room) => MenuAction[]
  drops: RosterDrops
}

export function FolderGroup(props: FolderGroupProps): React.JSX.Element {
  const { folder, botActions, roomActions, selectBot, selectRoom, drops } = props
  const t = useLanguage((s) => s.t)
  const [collapsed, setCollapsed] = useState(false)
  const snapshot = useRoster((state) => state.snapshot)
  const saving = useRoster((state) => state.saving)
  const id = folder?.id ?? null
  const items = folderItems(snapshot, id)
  const keys = items.map((item) => itemKey(itemRef(item)))
  const children = snapshot.folders.filter((item) => item.parentId === id)
  // A row takes bots and rooms; `after` is in front of the next row, or last.
  const rowEdges = (item: RosterDragItem): DropEdge[] | null =>
    saving || item.kind === 'folder' ? null : ['before', 'after']
  const dropOnRow = (index: number) => (item: RosterDragItem, edge: DropEdge) =>
    drops.item(item, {
      folderId: id,
      before: edge === 'before' ? keys[index] : (keys[index + 1] ?? null)
    })
  return (
    <section
      aria-label={folder?.name ?? t('roster.unassigned')}
      className="min-w-0 py-2"
      // The folder's empty space (its "No bots here" line, the gaps) takes a drop as "into, last".
      onDragOver={(event) => {
        if (!saving && draggedItem()) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
      onDrop={(event) => {
        const item = draggedItem()
        event.preventDefault()
        event.stopPropagation()
        endRosterDrag()
        if (!item || saving) return
        if (item.kind === 'folder') drops.folder(item.id, { parentId: id, beforeId: null })
        else drops.item(item, { folderId: id, before: null })
      }}
    >
      <FolderHeader
        folder={folder}
        collapsed={collapsed}
        toggle={() => setCollapsed(!collapsed)}
        folderActions={props.folderActions}
        drops={drops}
      />
      {!collapsed && (
        // Indented so a row's avatar lines up under the folder's name, past its chevron.
        <div className="mt-1 space-y-1 pl-6">
          {items.map((item, index) => (
            <DropSlot key={keys[index]} edges={rowEdges} onDrop={dropOnRow(index)}>
              {item.kind === 'bot' ? (
                <BotRow
                  bot={item.bot}
                  actions={botActions(item.bot)}
                  onSelect={() => selectBot(item.bot)}
                />
              ) : (
                <RoomRow
                  room={item.room}
                  actions={roomActions(item.room)}
                  onSelect={() => selectRoom(item.room)}
                />
              )}
            </DropSlot>
          ))}
          {children.map((child) => (
            <div key={child.id}>
              <FolderGroup {...props} folder={child} />
            </div>
          ))}
          {items.length + children.length === 0 && (
            <div className="flex items-center justify-between gap-2 px-3 py-1">
              <p className="text-sm text-muted-foreground">{t('roster.emptyFolder')}</p>
              {folder && (
                <Button
                  variant="ghost"
                  className="h-8 px-3 text-sm"
                  disabled={saving}
                  onClick={() => {
                    useRoster.getState().clearError()
                    useCreating.getState().createBotIn(folder.id)
                  }}
                >
                  {t('create.title')}
                </Button>
              )}
            </div>
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
  folderActions,
  drops
}: {
  folder: Folder | null
  collapsed: boolean
  toggle: () => void
  folderActions: (folder: Folder) => MenuAction[]
  drops: RosterDrops
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const snapshot = useRoster((state) => state.snapshot)
  const saving = useRoster((state) => state.saving)
  const name = folder?.name ?? t('roster.unassigned')
  // Bots and rooms drop into the folder; a folder goes in front of it (top part) or inside it.
  // Unassigned is not a folder: a folder dropped on it goes to the top level, last.
  const edges = (item: RosterDragItem): DropEdge[] | null => {
    if (saving) return null
    if (item.kind !== 'folder' || !folder) return ['inside']
    if (item.id === folder.id || isWithin(snapshot.folders, folder.id, item.id)) return null
    return ['before', 'inside']
  }
  const onDrop = (item: RosterDragItem, edge: DropEdge): void => {
    if (item.kind !== 'folder')
      return drops.item(item, { folderId: folder?.id ?? null, before: null })
    if (!folder) return drops.folder(item.id, { parentId: null, beforeId: null })
    drops.folder(
      item.id,
      edge === 'before'
        ? { parentId: folder.parentId ?? null, beforeId: folder.id }
        : { parentId: folder.id, beforeId: null }
    )
  }
  // The whole header hovers as one rounded row, as a bot's row does; its `…` has its own hover.
  return (
    <DropSlot edges={edges} onDrop={onDrop}>
      <ContextMenuArea actions={folder ? folderActions(folder) : []} disabled={!folder || saving}>
        <div
          className="group flex items-center rounded-xl pr-1 transition-colors hover:bg-accent"
          draggable={!!folder && !saving}
          onDragStart={(event) =>
            folder && startRosterDrag(event, { kind: 'folder', id: folder.id })
          }
          onDragEnd={endRosterDrag}
        >
          <OverflowTooltip text={name}>
            <button
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground"
              aria-expanded={!collapsed}
              onClick={toggle}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              <span className="truncate">{name}</span>
              <span className="ml-auto tabular-nums">
                {folderCount(snapshot, folder?.id ?? null)}
              </span>
            </button>
          </OverflowTooltip>
          {folder ? (
            <RosterMenu
              label={t('roster.folderActionsFor').replace('{name}', folder.name)}
              actions={folderActions(folder)}
              disabled={saving}
              className="size-8"
            />
          ) : (
            // Unassigned has no menu; the gap keeps its count in line with the folders above.
            <span className="size-8 shrink-0" aria-hidden="true" />
          )}
        </div>
      </ContextMenuArea>
    </DropSlot>
  )
}
