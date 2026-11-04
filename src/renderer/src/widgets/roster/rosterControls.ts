import { isWithin, pinnedBots } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { RosterActions } from '@features/bots/actions'
import type { Bot, Folder } from '@features/bots/types'
import type { TranslationKey } from '@shared/lib/i18n'
import type { MenuAction } from './RosterMenu'

export const ROSTER_DRAG = 'application/x-talyx-roster'

export interface RosterDragItem {
  kind: 'bot' | 'room' | 'folder'
  id: string
}

// Anything else dropped here (text, files, other apps' payloads) is not a roster item.
export function readRosterDrag(data: string): RosterDragItem | null {
  try {
    const item = JSON.parse(data)
    return item && ['bot', 'room', 'folder'].includes(item.kind) && typeof item.id === 'string'
      ? { kind: item.kind, id: item.id }
      : null
  } catch {
    return null
  }
}

interface ControlsOptions {
  actions: RosterActions
  run: (operation: () => Promise<void>) => void
  selectBot: (bot: Bot) => void
  setDeleting: (bot: Bot) => void
  t: (key: TranslationKey) => string
}

export function rosterControls(options: ControlsOptions): {
  botActions: (bot: Bot) => MenuAction[]
  folderActions: (folder: Folder) => MenuAction[]
  dropOnFolder: (data: string, folderId: string | null) => void
} {
  return {
    botActions: (bot) => botActions(bot, options),
    folderActions: (folder) => folderActions(folder, options),
    dropOnFolder: (data, folderId) => dropOnFolder(readRosterDrag(data), folderId, options)
  }
}

function botActions(bot: Bot, options: ControlsOptions): MenuAction[] {
  const { actions, run, selectBot, setDeleting, t } = options
  const { folders } = useRoster.getState().snapshot
  // A section that no longer exists shows in Unassigned, so it counts as Unassigned here too.
  const current = folders.some((folder) => folder.id === bot.meta.sectionId)
    ? bot.meta.sectionId
    : null
  return [
    {
      label: bot.meta.pinned ? t('roster.unpin') : t('roster.pin'),
      onSelect: () => run(() => actions.pin(bot))
    },
    ...pinOrderActions(bot, options),
    ...[{ id: null, name: t('roster.unassigned') }, ...folders]
      .filter((folder) => folder.id !== current)
      .map((folder) => ({
        label: t('roster.moveTo').replace('{name}', folder.name),
        onSelect: () => run(() => actions.moveBot(bot, folder.id))
      })),
    {
      label: t('roster.editProfile'),
      onSelect: () => {
        selectBot(bot)
        useRoster.getState().editProfile(bot.name)
      }
    },
    { label: t('roster.hide'), onSelect: () => run(() => actions.hide(bot)) },
    {
      label: t('roster.deleteProfile'),
      disabled: bot.name === 'default',
      onSelect: () => setDeleting(bot)
    }
  ]
}

function folderActions(folder: Folder, { actions, run, t }: ControlsOptions): MenuAction[] {
  const { folders } = useRoster.getState().snapshot
  return [
    { label: t('roster.moveUp'), onSelect: () => run(() => actions.orderFolder(folder.id, -1)) },
    { label: t('roster.moveDown'), onSelect: () => run(() => actions.orderFolder(folder.id, 1)) },
    ...(folder.parentId
      ? [{ label: t('roster.moveToTop'), onSelect: () => run(() => actions.nest(folder.id, null)) }]
      : []),
    ...folders
      .filter((item) => item.id !== folder.parentId && !isWithin(folders, item.id, folder.id))
      .map((item) => ({
        label: t('roster.nestIn').replace('{name}', item.name),
        onSelect: () => run(() => actions.nest(folder.id, item.id))
      }))
  ]
}

function dropOnFolder(
  item: RosterDragItem | null,
  folderId: string | null,
  { actions, run }: ControlsOptions
): void {
  const snapshot = useRoster.getState().snapshot
  if (item?.kind === 'folder') {
    // Releasing a folder inside itself or a descendant is a no-op, not an error.
    if (!folderId || !isWithin(snapshot.folders, folderId, item.id))
      run(() => actions.nest(item.id, folderId))
  }
  if (item?.kind === 'room' && snapshot.rooms.some((room) => room.room_id === item.id))
    run(() => actions.moveRoom(item.id, folderId))
  const bot = item?.kind === 'bot' && snapshot.bots.find((candidate) => candidate.name === item.id)
  if (bot) run(() => actions.moveBot(bot, folderId))
}

function pinOrderActions(bot: Bot, { actions, run, t }: ControlsOptions): MenuAction[] {
  const pins = pinnedBots(useRoster.getState().snapshot.bots)
  const index = pins.findIndex((item) => item.name === bot.name)
  if (index < 0) return []
  return [-1, 1]
    .filter((direction) => pins[index + direction])
    .map((direction) => ({
      label: direction < 0 ? t('roster.pinEarlier') : t('roster.pinLater'),
      onSelect: () => run(() => actions.orderPin(bot.name, pins[index + direction].name))
    }))
}
