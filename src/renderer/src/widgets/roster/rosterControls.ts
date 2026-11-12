import {
  folderItems,
  isWithin,
  itemFolder,
  itemKey,
  itemRef,
  pinnedBots
} from '@features/bots/roster'
import { bulkChoices, refusesFolder } from '@features/bots/bulk'
import { useRoster } from '@features/bots/store'
import type { RosterActions } from '@features/bots/actions'
import type { Bot, Folder, Room, RosterItemRef, RosterRowRef } from '@features/bots/types'
import type { TranslationKey } from '@shared/lib/i18n'
import type { RosterDragItem } from './drag'
import { pickedRows } from './picks'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCheck,
  EyeOff,
  Folder as FolderIcon,
  FolderInput,
  FolderPlus,
  Inbox,
  Pencil,
  Pin,
  PinOff,
  Trash2
} from 'lucide-react'
import type { MenuAction } from '@shared/ui/menu'

interface ControlsOptions {
  actions: RosterActions
  run: (operation: () => Promise<void>) => void
  selectBot: (bot: Bot) => void
  setDeleting: (bot: Bot) => void
  setDeletingRoom: (room: Room) => void
  setRenamingFolder: (folder: Folder) => void
  setDeletingFolder: (folder: Folder) => void
  setSubfolderOf: (folder: Folder) => void
  setDeletingRows: (rows: RosterRowRef[]) => void
  t: (key: TranslationKey) => string
}

/** Where dragged roster items land: rows into a folder's list, folders in the folder tree. */
export interface RosterDrops {
  /**
   * A bot or room, or several picked rows, into `folderId`, in front of the row keyed `before`
   * (null: last).
   */
  items: (rows: RosterDragItem[], place: { folderId: string | null; before: string | null }) => void
  /** A folder under `parentId` (null: top level), in front of `beforeId` (null: last). */
  folder: (id: string, place: { parentId: string | null; beforeId: string | null }) => void
}

export function rosterControls(options: ControlsOptions): {
  botActions: (bot: Bot) => MenuAction[]
  roomActions: (room: Room) => MenuAction[]
  folderActions: (folder: Folder) => MenuAction[]
  drops: RosterDrops
} {
  const { actions, run } = options
  return {
    botActions: (bot) =>
      pickedOr({ kind: 'bot', id: bot.name }, () => botActions(bot, options), options),
    roomActions: (room) =>
      pickedOr({ kind: 'room', id: room.room_id }, () => roomActions(room, options), options),
    folderActions: (folder) =>
      pickedOr({ kind: 'folder', id: folder.id }, () => folderActions(folder, options), options),
    drops: {
      items: (rows, place) => {
        if (rows.length > 1) return run(() => actions.placeRows(rows, place))
        const [{ kind, id }] = rows
        if (kind !== 'folder') run(() => actions.placeItem({ kind, id }, place))
      },
      folder: (id, place) => {
        // Releasing a folder inside itself or a descendant is a no-op, not an error.
        const { folders } = useRoster.getState().snapshot
        if (!place.parentId || !isWithin(folders, place.parentId, id))
          run(() => actions.placeFolder({ id, ...place }))
      }
    }
  }
}

function botActions(bot: Bot, options: ControlsOptions): MenuAction[] {
  const { actions, run, selectBot, setDeleting, t } = options
  const current = itemFolder(useRoster.getState().snapshot, { kind: 'bot', id: bot.name })
  return [
    {
      label: bot.meta.pinned ? t('roster.unpin') : t('roster.pin'),
      icon: bot.meta.pinned ? PinOff : Pin,
      onSelect: () => run(() => actions.pin(bot))
    },
    ...pinOrderActions(bot, options),
    ...(bot.meta.pinned ? [] : stepActions({ kind: 'bot', id: bot.name }, options)),
    moveToMenu({ current, move: (folderId) => run(() => actions.moveBot(bot, folderId)) }, options),
    {
      label: t('roster.editProfile'),
      icon: Pencil,
      separated: true,
      onSelect: () => {
        selectBot(bot)
        useRoster.getState().editProfile(bot.name)
      }
    },
    {
      label: t('roster.deleteProfile'),
      icon: Trash2,
      destructive: true,
      separated: true,
      disabled: bot.name === 'default',
      onSelect: () => setDeleting(bot)
    }
  ]
}

function roomActions(room: Room, options: ControlsOptions): MenuAction[] {
  const { actions, run, setDeletingRoom, t } = options
  const snapshot = useRoster.getState().snapshot
  const current = itemFolder(snapshot, { kind: 'room', id: room.room_id })
  const pinned = snapshot.roomPins.includes(room.room_id)
  return [
    {
      label: pinned ? t('roster.unpin') : t('roster.pin'),
      icon: pinned ? PinOff : Pin,
      onSelect: () => run(() => actions.pinRoom(room))
    },
    ...(pinned ? [] : stepActions({ kind: 'room', id: room.room_id }, options)),
    moveToMenu(
      { current, move: (folderId) => run(() => actions.moveRoom(room.room_id, folderId)) },
      options
    ),
    {
      label: t('roster.deleteRoom'),
      icon: Trash2,
      destructive: true,
      separated: true,
      onSelect: () => setDeletingRoom(room)
    }
  ]
}

// Right-click on one of several picked rows acts on all of them.
function pickedOr(
  row: RosterRowRef,
  single: () => MenuAction[],
  options: ControlsOptions
): MenuAction[] {
  const { picked } = useRoster.getState()
  return picked.length > 1 && picked.includes(itemKey(row))
    ? pickedActions(pickedRows(), options)
    : single()
}

// "N selected", then only the actions that suit every picked row.
function pickedActions(rows: RosterRowRef[], options: ControlsOptions): MenuAction[] {
  const { actions, run, setDeletingRows, t } = options
  const snapshot = useRoster.getState().snapshot
  const choices = bulkChoices(snapshot, rows)
  const entries: (MenuAction | false)[] = [
    { label: t('roster.picked').replace('{count}', String(rows.length)), heading: true },
    moveToMenu(
      {
        current: undefined,
        move: (folderId) => run(() => actions.moveRows(rows, folderId)),
        refused: (folderId) => refusesFolder(snapshot, rows, folderId)
      },
      options
    ),
    !!choices.pin && {
      label: t(choices.pin === 'pin' ? 'roster.pin' : 'roster.unpin'),
      icon: choices.pin === 'pin' ? Pin : PinOff,
      onSelect: () => run(() => actions.pinRows(rows))
    },
    choices.markRead && {
      label: t('roster.markRead'),
      icon: CheckCheck,
      onSelect: () => useRoster.getState().markRead(rows)
    },
    choices.hide && {
      label: t('roster.hide'),
      icon: EyeOff,
      onSelect: () => run(() => actions.hideRows(rows))
    },
    choices.delete && {
      label: t('roster.deleteRows'),
      icon: Trash2,
      destructive: true,
      separated: true,
      onSelect: () => setDeletingRows(rows)
    }
  ]
  return entries.filter((entry): entry is MenuAction => !!entry)
}

// "Move to ›": every folder, and Unassigned after a line; the current one checked, and a folder
// the rows cannot go into (a picked folder or one inside it) greyed.
function moveToMenu(
  target: {
    current: string | null | undefined
    move: (folderId: string | null) => void
    refused?: (folderId: string) => boolean
  },
  { t }: ControlsOptions
): MenuAction {
  const { current, move, refused } = target
  const { folders } = useRoster.getState().snapshot
  return {
    label: t('roster.moveTo'),
    icon: FolderInput,
    submenu: [
      ...folders.map((folder) => ({
        label: folder.name,
        icon: FolderIcon,
        current: folder.id === current,
        disabled: refused?.(folder.id),
        onSelect: () => move(folder.id)
      })),
      {
        label: t('roster.unassigned'),
        icon: Inbox,
        separated: true,
        current: current === null,
        onSelect: () => move(null)
      }
    ]
  }
}

// Dragging sorts with a pointer; these are the same moves from the keyboard.
function stepActions(item: RosterItemRef, { actions, run, t }: ControlsOptions): MenuAction[] {
  const snapshot = useRoster.getState().snapshot
  const keys = folderItems(snapshot, itemFolder(snapshot, item)).map((row) => itemKey(itemRef(row)))
  const index = keys.indexOf(itemKey(item))
  return [
    { label: t('roster.moveUp'), icon: ArrowUp, direction: -1 as const, possible: index > 0 },
    {
      label: t('roster.moveDown'),
      icon: ArrowDown,
      direction: 1 as const,
      possible: index >= 0 && index < keys.length - 1
    }
  ]
    .filter((step) => step.possible)
    .map((step) => ({
      label: step.label,
      icon: step.icon,
      onSelect: () => run(() => actions.stepItem(item, step.direction))
    }))
}

function folderActions(
  folder: Folder,
  { setRenamingFolder, setDeletingFolder, setSubfolderOf, t }: ControlsOptions
): MenuAction[] {
  return [
    { label: t('roster.newFolder'), icon: FolderPlus, onSelect: () => setSubfolderOf(folder) },
    {
      label: t('roster.renameFolder'),
      icon: Pencil,
      separated: true,
      onSelect: () => setRenamingFolder(folder)
    },
    {
      label: t('roster.deleteFolder'),
      icon: Trash2,
      destructive: true,
      separated: true,
      onSelect: () => setDeletingFolder(folder)
    }
  ]
}

function pinOrderActions(bot: Bot, { actions, run, t }: ControlsOptions): MenuAction[] {
  const pins = pinnedBots(useRoster.getState().snapshot.bots)
  const index = pins.findIndex((item) => item.name === bot.name)
  if (index < 0) return []
  return [-1, 1]
    .filter((direction) => pins[index + direction])
    .map((direction) => ({
      label: direction < 0 ? t('roster.pinEarlier') : t('roster.pinLater'),
      icon: direction < 0 ? ArrowLeft : ArrowRight,
      onSelect: () => run(() => actions.orderPin(bot.name, pins[index + direction].name))
    }))
}
