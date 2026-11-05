import type { TranslationKey } from '@shared/lib/i18n'
import type { Bot, Folder, Room, RosterItem, RosterItemRef, RosterSnapshot } from './types'

export const FOLDERS_KEY = 'talyx-folders'
export const ROOM_FOLDERS_KEY = 'talyx-room-folders'
export const ROOM_PINS_KEY = 'talyx-room-pins'
export const ITEM_ORDER_KEY = 'talyx-item-order'

// Thrown for a roster problem the user can act on; `key` is its message in i18n.ts.
export class RosterError extends Error {
  constructor(
    readonly key: TranslationKey,
    readonly detail: string | null = null
  ) {
    super(key)
    this.name = 'RosterError'
  }
}

export interface RosterProblem {
  key: TranslationKey
  detail: string | null
}

export function problemOf(error: unknown): RosterProblem {
  return error instanceof RosterError
    ? { key: error.key, detail: error.detail }
    : { key: 'roster.errorUnexpected', detail: error instanceof Error ? error.message : null }
}

export function botTitle(bot: Bot): string {
  return bot.name === 'default'
    ? 'Talyx'
    : bot.meta.title || bot.title || bot.display_name || bot.name
}

export function botPreview(bot: Bot): string {
  return (
    bot.canonical_session?.preview?.trim() ||
    bot.last_session?.preview?.trim() ||
    bot.meta.description ||
    bot.description ||
    ''
  )
}

/** The bot's chat: the profile's canonical session, at the tip of its compression lineage. */
export function botChatId(bot: Bot): string | null {
  return bot.canonical_session?.resolved_id || bot.canonical_session?.id || null
}

export function botActivityTime(bot: Bot): number {
  return bot.canonical_session?.last_active ?? bot.last_session?.last_active ?? 0
}

export function timeInWords(
  timestamp: number,
  t: (key: TranslationKey) => string,
  now = Date.now()
): string {
  if (!timestamp || !Number.isFinite(timestamp)) return ''
  const minutes = Math.max(0, Math.floor((now - timestamp * 1000) / 60000))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (minutes < 1) return t('time.justNow')
  if (minutes < 60) return ago(minutes, ['time.minute', 'time.minutes'], t)
  if (hours < 24) return ago(hours, ['time.hour', 'time.hours'], t)
  return ago(days, ['time.day', 'time.days'], t)
}

function ago(
  count: number,
  [one, many]: [TranslationKey, TranslationKey],
  t: (key: TranslationKey) => string
): string {
  return count === 1 ? t(one) : t(many).replace('{count}', String(count))
}

export function pinnedBots(bots: Bot[]): Bot[] {
  return bots
    .filter((bot) => bot.meta.pinned && !bot.meta.hidden)
    .sort((a, b) => {
      const order = (a.meta.pinnedOrder ?? Infinity) - (b.meta.pinnedOrder ?? Infinity)
      return (
        (Number.isNaN(order) ? 0 : order) ||
        botActivityTime(b) - botActivityTime(a) ||
        a.name.localeCompare(b.name)
      )
    })
}

export function folderBots(snapshot: RosterSnapshot, folderId: string | null): Bot[] {
  const ids = new Set(snapshot.folders.map((folder) => folder.id))
  return snapshot.bots.filter((bot) => {
    const meta = bot.meta
    const sectionId = meta.sectionId && ids.has(meta.sectionId) ? meta.sectionId : null
    return !meta.hidden && !meta.pinned && sectionId === folderId
  })
}

// A room in a folder that no longer exists shows as unassigned; a pinned room shows with the pins.
export function folderRooms(snapshot: RosterSnapshot, folderId: string | null): Room[] {
  const ids = new Set(snapshot.folders.map((folder) => folder.id))
  return snapshot.rooms.filter((room) => {
    const assigned = snapshot.roomFolders[room.room_id]
    return (
      !snapshot.roomPins.includes(room.room_id) &&
      (assigned && ids.has(assigned) ? assigned : null) === folderId
    )
  })
}

/** Pinned rooms in the order they were pinned; a pin whose room is gone is skipped. */
export function pinnedRooms(snapshot: RosterSnapshot): Room[] {
  return snapshot.roomPins.flatMap((id) => snapshot.rooms.filter((room) => room.room_id === id))
}

// A folder counts the bots in it and in its subfolders; Unassigned counts only its own.
export function folderCount(snapshot: RosterSnapshot, folderId: string | null): number {
  if (folderId === null) return folderBots(snapshot, null).length
  return snapshot.folders
    .filter((folder) => isWithin(snapshot.folders, folder.id, folderId))
    .reduce((total, folder) => total + folderBots(snapshot, folder.id).length, 0)
}

export function isWithin(folders: Folder[], id: string, ancestorId: string): boolean {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  let cursor: string | undefined = id
  for (let hops = 0; cursor && hops <= byId.size; hops++) {
    if (cursor === ancestorId) return true
    cursor = byId.get(cursor)?.parentId
  }
  return false
}

// Ported folder normalization: malformed parents must never hide a folder or loop rendering.
export function normalizeFolders(value: unknown): Folder[] {
  if (!Array.isArray(value)) return []
  const folders: Folder[] = []
  for (const entry of value as unknown[]) {
    if (!entry || typeof entry !== 'object') continue
    const { id, name, parentId } = entry as Record<string, unknown>
    if (typeof id !== 'string' || !id.trim() || typeof name !== 'string' || !name.trim()) continue
    if (folders.some((folder) => folder.id === id.trim())) continue
    folders.push({
      id: id.trim(),
      name: name.trim(),
      ...(typeof parentId === 'string' && parentId.trim() ? { parentId: parentId.trim() } : {})
    })
  }
  for (const folder of folders) {
    if (
      folder.parentId &&
      (!folders.some((item) => item.id === folder.parentId) ||
        isWithin(folders, folder.parentId, folder.id))
    )
      delete folder.parentId
  }
  return folders
}

/** A folder's name with its parents, for a folder picker. */
export function folderPath(folders: Folder[], folder: Folder): string {
  const parent = folders.find((item) => item.id === folder.parentId)
  return parent ? `${folderPath(folders, parent)} / ${folder.name}` : folder.name
}

export function recoverFolders(bots: Bot[]): Folder[] {
  return normalizeFolders(
    bots.map((bot) => {
      const meta = bot.meta
      return { id: meta.sectionId, name: meta.sectionName || meta.sectionId }
    })
  )
}

export function moveFolder(folders: Folder[], id: string, parentId: string | null): Folder[] {
  if (!folders.some((folder) => folder.id === id)) throw new RosterError('roster.errorFolderGone')
  if (
    parentId &&
    (!folders.some((folder) => folder.id === parentId) || isWithin(folders, parentId, id))
  )
    throw new RosterError('roster.errorFolderCycle')
  return folders.map((folder) =>
    folder.id === id ? { id, name: folder.name, ...(parentId ? { parentId } : {}) } : folder
  )
}

export function itemRef(item: RosterItem): RosterItemRef {
  return item.kind === 'bot'
    ? { kind: 'bot', id: item.bot.name }
    : { kind: 'room', id: item.room.room_id }
}

/** The key of a bot or room in `itemOrder`. */
export function itemKey(ref: RosterItemRef): string {
  return `${ref.kind}:${ref.id}`
}

/** The folder a bot or room shows in: null for Unassigned or a folder that no longer exists. */
export function itemFolder(snapshot: RosterSnapshot, ref: RosterItemRef): string | null {
  const assigned =
    ref.kind === 'bot'
      ? snapshot.bots.find((bot) => bot.name === ref.id)?.meta.sectionId
      : snapshot.roomFolders[ref.id]
  return assigned && snapshot.folders.some((folder) => folder.id === assigned) ? assigned : null
}

/** A folder's key in `itemOrder`: its id, or '' for Unassigned. */
export function orderKey(folderId: string | null): string {
  return folderId ?? ''
}

/** A folder's bots and rooms as one list, in their dragged order. */
export function folderItems(snapshot: RosterSnapshot, folderId: string | null): RosterItem[] {
  const items: RosterItem[] = [
    ...folderBots(snapshot, folderId).map((bot) => ({ kind: 'bot' as const, bot })),
    ...folderRooms(snapshot, folderId).map((room) => ({ kind: 'room' as const, room }))
  ]
  const order = snapshot.itemOrder[orderKey(folderId)] ?? []
  const rank = (item: RosterItem): number => {
    const index = order.indexOf(itemKey(itemRef(item)))
    return index < 0 ? order.length : index
  }
  // Array.sort is stable, so unlisted items keep the engine's order after the listed ones.
  return items.sort((a, b) => rank(a) - rank(b))
}

/** `keys` with `key` moved in front of `before`, or to the end when `before` is null or absent. */
export function placeKey(keys: string[], key: string, before: string | null): string[] {
  const rest = keys.filter((item) => item !== key)
  const at = before === null ? -1 : rest.indexOf(before)
  return at < 0 ? [...rest, key] : [...rest.slice(0, at), key, ...rest.slice(at)]
}

/**
 * The folder moved under `parentId` (null: top level), in front of the sibling `beforeId`, or
 * last among its siblings. Siblings take their order from the layout array.
 */
export function placeFolder(
  folders: Folder[],
  move: { id: string; parentId: string | null; beforeId: string | null }
): Folder[] {
  const moved = moveFolder(folders, move.id, move.parentId)
  const folder = moved.find((item) => item.id === move.id)!
  const rest = moved.filter((item) => item.id !== move.id)
  const at = move.beforeId === null ? -1 : rest.findIndex((item) => item.id === move.beforeId)
  return at < 0 ? [...rest, folder] : [...rest.slice(0, at), folder, ...rest.slice(at)]
}

/** The layout without the folder; its subfolders move up to its parent. */
export function removeFolder(folders: Folder[], id: string): Folder[] {
  const gone = folders.find((folder) => folder.id === id)
  if (!gone) throw new RosterError('roster.errorFolderGone')
  return folders
    .filter((folder) => folder.id !== id)
    .map((folder) =>
      folder.parentId === id
        ? {
            id: folder.id,
            name: folder.name,
            ...(gone.parentId ? { parentId: gone.parentId } : {})
          }
        : folder
    )
}
