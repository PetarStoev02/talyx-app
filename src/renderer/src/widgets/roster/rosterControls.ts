import { botMeta, isWithin, pinnedBots } from '@features/bots/roster'
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

export function rosterControls({ actions, run, selectBot, setDeleting, t }: ControlsOptions): {
  botActions: (bot: Bot) => MenuAction[]
  folderActions: (folder: Folder) => MenuAction[]
  dropOnFolder: (data: string, folderId: string | null) => void
} {
  const snapshot = (): ReturnType<typeof useRoster.getState>['snapshot'] =>
    useRoster.getState().snapshot
  const botActions = (bot: Bot): MenuAction[] => {
    const sectionId = botMeta(bot).sectionId ?? null
    return [
      {
        label: botMeta(bot).pinned ? t('roster.unpin') : t('roster.pin'),
        onSelect: () => run(() => actions.pin(bot))
      },
      ...pinOrderActions(bot, { actions, run, t }),
      ...[{ id: null, name: t('roster.unassigned') }, ...snapshot().folders]
        .filter((folder) => folder.id !== sectionId)
        .map((folder) => ({
          label: t('roster.moveTo').replace('{name}', folder.name),
          onSelect: () => run(() => actions.moveBot(bot, folder.id))
        })),
      {
        label: t('roster.editProfile'),
        onSelect: () => {
          selectBot(bot)
          useRoster.setState({ editingProfile: bot.name })
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
  const folderActions = (folder: Folder): MenuAction[] => [
    { label: t('roster.moveUp'), onSelect: () => run(() => actions.orderFolder(folder.id, -1)) },
    { label: t('roster.moveDown'), onSelect: () => run(() => actions.orderFolder(folder.id, 1)) },
    { label: t('roster.moveToTop'), onSelect: () => run(() => actions.nest(folder.id, null)) },
    ...snapshot()
      .folders.filter((item) => !isWithin(snapshot().folders, item.id, folder.id))
      .map((item) => ({
        label: t('roster.nestIn').replace('{name}', item.name),
        onSelect: () => run(() => actions.nest(folder.id, item.id))
      }))
  ]
  const dropOnFolder = (data: string, folderId: string | null): void => {
    const item = readRosterDrag(data)
    if (!item) return
    if (item.kind === 'folder') {
      // Releasing a folder inside itself or a descendant is a no-op, not an error.
      if (!folderId || !isWithin(snapshot().folders, folderId, item.id))
        run(() => actions.nest(item.id, folderId))
      return
    }
    if (item.kind === 'room') {
      if (snapshot().rooms.some((room) => room.room_id === item.id))
        run(() => actions.moveRoom(item.id, folderId))
      return
    }
    const bot = snapshot().bots.find((bot) => bot.name === item.id)
    if (bot) run(() => actions.moveBot(bot, folderId))
  }
  return { botActions, folderActions, dropOnFolder }
}

function pinOrderActions(
  bot: Bot,
  { actions, run, t }: Pick<ControlsOptions, 'actions' | 'run' | 't'>
): MenuAction[] {
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
