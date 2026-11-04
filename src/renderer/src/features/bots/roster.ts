import type { TranslationKey } from '@shared/lib/i18n'
import type { Bot, Folder, Room, RosterSnapshot } from './types'

export const FOLDERS_KEY = 'talyx-folders'
export const ROOM_FOLDERS_KEY = 'talyx-room-folders'
export const ROOM_PINS_KEY = 'talyx-room-pins'

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

// A room in a folder that no longer exists shows as unassigned; pinned rooms lead, in pin order.
export function folderRooms(snapshot: RosterSnapshot, folderId: string | null): Room[] {
  const ids = new Set(snapshot.folders.map((folder) => folder.id))
  const pinOrder = (room: Room): number => {
    const index = snapshot.roomPins.indexOf(room.room_id)
    return index < 0 ? Infinity : index
  }
  return (
    snapshot.rooms
      .filter((room) => {
        const assigned = snapshot.roomFolders[room.room_id]
        return (assigned && ids.has(assigned) ? assigned : null) === folderId
      })
      // Two unpinned rooms compare as NaN, which keeps their engine order.
      .sort((a, b) => pinOrder(a) - pinOrder(b) || 0)
  )
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

export function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
