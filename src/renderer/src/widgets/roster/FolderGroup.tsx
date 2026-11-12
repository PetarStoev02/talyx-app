import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { folderCount, folderItems, isWithin, itemKey, itemRef } from '@features/bots/roster'
import { refusesFolder } from '@features/bots/bulk'
import { useRoster } from '@features/bots/store'
import { useLanguage } from '@app/providers/useLanguage'
import type { Bot, Folder, Room } from '@features/bots/types'
import { OverflowTooltip } from '@shared/ui/tooltip'
import { cn } from '@shared/lib/utils'
import { BotRow } from './BotRow'
import { DropSlot } from './DropSlot'
import type { DropEdge } from './DropSlot'
import { draggedRows, endRosterDrag, startRosterDrag } from './drag'
import { clickRow } from './picks'
import type { RosterDragItem } from './drag'
import { ROW_AVATAR_BOX, RoomRow } from './RoomRow'
import type { RosterDrops } from './rosterControls'
import { ContextMenuArea } from '@shared/ui/menu'
import type { MenuAction } from '@shared/ui/menu'
import { useCreating } from './creating'
import { Reveal } from '@shared/ui/Reveal'
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
  // Folders are open when the roster loads without unfolding; only a click animates them.
  const [toggled, setToggled] = useState(false)
  const snapshot = useRoster((state) => state.snapshot)
  const saving = useRoster((state) => state.saving)
  const id = folder?.id ?? null
  const items = folderItems(snapshot, id)
  const keys = items.map((item) => itemKey(itemRef(item)))
  const children = snapshot.folders.filter((item) => item.parentId === id)
  // A row takes bots and rooms, or several picked rows; `after` is in front of the next row, or
  // last. Picked rows never land inside a picked folder.
  const refused = (rows: RosterDragItem[]): boolean =>
    saving || refusesFolder(snapshot, rows, id) || (rows.length === 1 && rows[0].kind === 'folder')
  const rowEdges = (rows: RosterDragItem[]): DropEdge[] | null =>
    refused(rows) ? null : ['before', 'after']
  const dropOnRow = (index: number) => (rows: RosterDragItem[], edge: DropEdge) =>
    drops.items(rows, {
      folderId: id,
      before: edge === 'before' ? keys[index] : (keys[index + 1] ?? null)
    })
  return (
    <section
      aria-label={folder?.name ?? t('roster.unassigned')}
      data-flip={`folder:${id ?? ''}`}
      className="min-w-0 py-2"
      // The folder's empty space (its "No bots here" line, the gaps) takes a drop as "into, last".
      onDragOver={(event) => {
        const rows = draggedRows()
        if (!saving && rows.length && !refusesFolder(snapshot, rows, id)) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
      onDrop={(event) => {
        const rows = draggedRows()
        event.preventDefault()
        event.stopPropagation()
        endRosterDrag()
        if (!rows.length || saving || refusesFolder(snapshot, rows, id)) return
        if (rows.length === 1 && rows[0].kind === 'folder')
          drops.folder(rows[0].id, { parentId: id, beforeId: null })
        else drops.items(rows, { folderId: id, before: null })
      }}
    >
      <FolderHeader
        folder={folder}
        collapsed={collapsed}
        toggle={() => {
          setCollapsed(!collapsed)
          setToggled(true)
        }}
        folderActions={props.folderActions}
        drops={drops}
      />
      <Reveal value={!collapsed} className={toggled ? undefined : 'reveal-no-appear'}>
        {() => (
          // Indented so a row's avatar lines up under the folder's name, past its chevron.
          <div className="mt-1 space-y-1 pl-6">
            {items.map((item, index) => (
              <DropSlot
                key={keys[index]}
                flip={keys[index]}
                edges={rowEdges}
                onDrop={dropOnRow(index)}
              >
                {item.kind === 'bot' ? (
                  <BotRow
                    bot={item.bot}
                    actions={() => botActions(item.bot)}
                    onSelect={() => selectBot(item.bot)}
                  />
                ) : (
                  <RoomRow
                    room={item.room}
                    actions={() => roomActions(item.room)}
                    onSelect={() => selectRoom(item.room)}
                  />
                )}
              </DropSlot>
            ))}
            {children.map((child) => (
              <FolderGroup key={child.id} {...props} folder={child} />
            ))}
            {items.length + children.length === 0 &&
              (folder ? (
                // Laid out like a bot's row, so the empty folder reads as a place a bot will go.
                <button
                  disabled={saving}
                  onClick={() => {
                    useRoster.getState().clearError()
                    useCreating.getState().createBotIn(folder.id)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-dashed border-foreground/15 p-2 text-left transition-colors hover:border-foreground/30 hover:bg-accent disabled:opacity-50"
                >
                  <span
                    className="flex shrink-0 items-center justify-center text-muted-foreground"
                    style={{ width: ROW_AVATAR_BOX, height: ROW_AVATAR_BOX }}
                  >
                    <Plus size={18} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-medium">{t('create.title')}</span>
                    <span className="block text-sm text-muted-foreground">
                      {t('roster.emptyFolderHint')}
                    </span>
                  </span>
                </button>
              ) : (
                <p className="px-3 py-2 text-sm text-muted-foreground">{t('roster.emptyFolder')}</p>
              ))}
          </div>
        )}
      </Reveal>
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
  const row = folder && { kind: 'folder' as const, id: folder.id }
  const picked = useRoster((state) => !!row && state.picked.includes(itemKey(row)))
  // Bots and rooms drop into the folder; a folder goes in front of it (top part) or inside it.
  // Unassigned is not a folder: a folder dropped on it goes to the top level, last. Several
  // picked rows go inside, unless it is one of their folders.
  const edges = (rows: RosterDragItem[]): DropEdge[] | null => {
    if (saving) return null
    if (rows.length > 1)
      return refusesFolder(snapshot, rows, folder?.id ?? null) ? null : ['inside']
    const [item] = rows
    if (item.kind !== 'folder' || !folder) return ['inside']
    if (item.id === folder.id || isWithin(snapshot.folders, folder.id, item.id)) return null
    return ['before', 'inside']
  }
  const onDrop = (rows: RosterDragItem[], edge: DropEdge): void => {
    const [item] = rows
    if (rows.length > 1 || item.kind !== 'folder')
      return drops.items(rows, { folderId: folder?.id ?? null, before: null })
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
      <ContextMenuArea
        actions={() => (folder ? folderActions(folder) : [])}
        disabled={!folder || saving}
      >
        <div
          className={cn(
            'group flex items-center rounded-xl pr-1 transition-colors',
            picked ? 'bg-brand/15' : 'hover:bg-accent'
          )}
          draggable={!!folder && !saving}
          data-roster-row={row ? itemKey(row) : undefined}
          onDragStart={(event) => row && startRosterDrag(event, row)}
          onDragEnd={endRosterDrag}
        >
          <OverflowTooltip text={name}>
            <button
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground"
              aria-expanded={!collapsed}
              aria-description={picked ? t('roster.pickedRow') : undefined}
              onClick={(event) => (row ? clickRow(event, row, toggle) : toggle())}
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
              actions={() => folderActions(folder)}
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
