import { saveBotMeta, saveLayout } from './data'
import type { Layout, RosterStore } from './data'
import {
  folderItems,
  isWithin,
  itemFolder,
  itemKey,
  itemRef,
  orderKey,
  placeFolder,
  removeFolder,
  RosterError
} from './roster'
import type { Bot, RosterRowRef, RosterSnapshot } from './types'

// Several picked rows act together. The shared layout (folders, room folders, room pins, order)
// changes in one revision-checked save; a bot's own folder, pin and hidden mark live on its own
// profile, so each bot that changes is one save on that profile, after the layout.

/** Which actions suit every picked row; a mix of bots, rooms and folders gets the shared ones. */
export interface BulkChoices {
  /** Pin all of them, unpin all of them (when every one is pinned), or neither (a folder). */
  pin: 'pin' | 'unpin' | null
  markRead: boolean
  hide: boolean
  delete: boolean
}

export function bulkChoices(snapshot: RosterSnapshot, rows: RosterRowRef[]): BulkChoices {
  const onlyItems = rows.every((row) => row.kind !== 'folder')
  return {
    pin: onlyItems ? (rows.every((row) => isPinned(snapshot, row)) ? 'unpin' : 'pin') : null,
    markRead: onlyItems,
    hide: !hasTalyx(rows) && rows.every((row) => row.kind === 'bot'),
    delete: !hasTalyx(rows)
  }
}

/** True when `folderId` is a picked folder or inside one: the rows cannot go there. */
export function refusesFolder(
  snapshot: RosterSnapshot,
  rows: RosterRowRef[],
  folderId: string | null
): boolean {
  return (
    folderId !== null &&
    rows.some((row) => row.kind === 'folder' && isWithin(snapshot.folders, folderId, row.id))
  )
}

/**
 * The rows into `folderId` (null: Unassigned, or the top level for a folder), in the order given,
 * in front of the row keyed `before` (null: last). A picked folder brings what is in it; a row
 * inside a picked folder stays in it.
 */
export async function moveRows(
  backend: RosterStore,
  snapshot: RosterSnapshot,
  move: { rows: RosterRowRef[]; folderId: string | null; before: string | null }
): Promise<void> {
  const { folderId, before } = move
  if (refusesFolder(snapshot, move.rows, folderId)) throw new RosterError('roster.errorFolderCycle')
  const rows = move.rows.filter((row) => !insidePicked(snapshot, move.rows, row))
  const folders = rows.filter((row) => row.kind === 'folder').map((row) => row.id)
  const items = rows.filter((row) => row.kind !== 'folder')
  const rooms = items.filter((row) => row.kind === 'room').map((row) => row.id)
  const moving = new Set(items.map(itemKey))
  const keys = folderItems(snapshot, folderId).map((row) => itemKey(itemRef(row)))
  const at = before === null || !keys.includes(before) ? keys.length : keys.indexOf(before)
  const rest = keys.filter((key) => !moving.has(key))
  const restAt = keys.slice(0, at).filter((key) => !moving.has(key)).length
  await saveLayout(backend, snapshot, (layout) => ({
    ...(folders.length && {
      folders: folders.reduce(
        (value, id) => placeFolder(value, { id, parentId: folderId, beforeId: null }),
        layout.folders
      )
    }),
    ...(rooms.length && {
      roomFolders: {
        ...layout.roomFolders,
        ...Object.fromEntries(rooms.map((id) => [id, folderId]))
      },
      roomPins: layout.roomPins.filter((id) => !rooms.includes(id))
    }),
    ...(items.length && {
      itemOrder: {
        ...layout.itemOrder,
        [orderKey(folderId)]: [...rest.slice(0, restAt), ...moving, ...rest.slice(restAt)]
      }
    })
  }))
  const sectionName = snapshot.folders.find((folder) => folder.id === folderId)?.name ?? null
  for (const bot of botsOf(snapshot, items))
    if (bot.meta.pinned || itemFolder(snapshot, { kind: 'bot', id: bot.name }) !== folderId)
      await saveBotMeta(backend, bot.name, { pinned: false, sectionId: folderId, sectionName })
}

/** Pins every row, after the pins there are; or, when every row is pinned, unpins them all. */
export async function pinRows(
  backend: RosterStore,
  snapshot: RosterSnapshot,
  rows: RosterRowRef[]
): Promise<void> {
  const pin = bulkChoices(snapshot, rows).pin
  if (!pin) return
  const rooms = rows.filter((row) => row.kind === 'room').map((row) => row.id)
  if (rooms.length)
    await saveLayout(backend, snapshot, (layout) => ({
      roomPins:
        pin === 'unpin'
          ? layout.roomPins.filter((id) => !rooms.includes(id))
          : [...layout.roomPins, ...rooms.filter((id) => !layout.roomPins.includes(id))]
    }))
  let next = Math.max(-1, ...snapshot.bots.map((bot) => bot.meta.pinnedOrder ?? -1)) + 1
  for (const bot of botsOf(snapshot, rows)) {
    if (pin === 'unpin') await saveBotMeta(backend, bot.name, { pinned: false })
    else if (!bot.meta.pinned)
      await saveBotMeta(backend, bot.name, { pinned: true, pinnedOrder: next++ })
  }
}

export async function hideRows(
  backend: RosterStore,
  snapshot: RosterSnapshot,
  rows: RosterRowRef[]
): Promise<void> {
  if (hasTalyx(rows)) throw new RosterError('roster.errorKeepTalyx')
  for (const bot of botsOf(snapshot, rows)) await saveBotMeta(backend, bot.name, { hidden: true })
}

/**
 * Deletes the bots and rooms, then the folders in one layout save: what was in a deleted folder
 * and is not deleted itself moves up to the nearest folder that stays, or to Unassigned, after
 * that folder's own rows. The layout comes before the moved bots, so a failure part way never
 * hides one.
 */
export async function deleteRows(
  backend: RosterStore,
  snapshot: RosterSnapshot,
  rows: RosterRowRef[]
): Promise<void> {
  if (hasTalyx(rows)) throw new RosterError('roster.errorKeepTalyx')
  // A retry after a failure part way skips the bots and rooms already gone.
  const ids = (kind: RosterRowRef['kind']): string[] =>
    rows.filter((row) => row.kind === kind && stillThere(snapshot, row)).map((row) => row.id)
  const [bots, rooms, folders] = [ids('bot'), ids('room'), ids('folder')]
  for (const room of rooms) await backend.deleteRoom(room)
  for (const bot of bots) await backend.deleteProfile(bot)
  if (!rooms.length && !folders.length) return
  const deleted = new Set(rows.filter((row) => row.kind !== 'folder').map(itemKey))
  const landing = (id: string | null): string | null => {
    let cursor = id
    while (cursor && folders.includes(cursor))
      cursor = snapshot.folders.find((folder) => folder.id === cursor)?.parentId ?? null
    return cursor
  }
  await saveLayout(backend, snapshot, (layout) => ({
    ...(folders.length && {
      folders: folders.reduce(removeFolder, layout.folders),
      itemOrder: mergedOrder(snapshot, { layout, folders, deleted, landing })
    }),
    roomFolders: Object.fromEntries(
      Object.entries(layout.roomFolders)
        .filter(([room]) => !rooms.includes(room))
        .map(([room, folder]) => [room, landing(folder)])
    ),
    ...(rooms.length && { roomPins: layout.roomPins.filter((id) => !rooms.includes(id)) })
  }))
  for (const bot of snapshot.bots) {
    const from = bot.meta.sectionId ?? null
    if (bots.includes(bot.name) || !from || !folders.includes(from)) continue
    const to = landing(from)
    const sectionName = snapshot.folders.find((folder) => folder.id === to)?.name ?? null
    await saveBotMeta(backend, bot.name, { sectionId: to, sectionName })
  }
}

// Each deleted folder's rows that stay go after the rows of the folder they land in, as they showed.
function mergedOrder(
  snapshot: RosterSnapshot,
  removal: {
    layout: Layout
    folders: string[]
    deleted: Set<string>
    landing: (id: string | null) => string | null
  }
): Layout['itemOrder'] {
  const { layout, folders, deleted, landing } = removal
  const keysIn = (id: string | null): string[] =>
    folderItems(snapshot, id)
      .map((row) => itemKey(itemRef(row)))
      .filter((key) => !deleted.has(key))
  const order = Object.fromEntries(
    Object.entries(layout.itemOrder).filter(([folder]) => !folders.includes(folder))
  )
  const merged = new Map<string | null, string[]>()
  for (const folder of snapshot.folders.filter((item) => folders.includes(item.id))) {
    const to = landing(folder.id)
    merged.set(to, [...(merged.get(to) ?? keysIn(to)), ...keysIn(folder.id)])
  }
  for (const [to, keys] of merged) order[orderKey(to)] = keys
  return order
}

// A row's own folder holds it only while it shows there: a pinned bot or room shows with the pins.
function insidePicked(
  snapshot: RosterSnapshot,
  picked: RosterRowRef[],
  row: RosterRowRef
): boolean {
  const home =
    row.kind === 'folder'
      ? (snapshot.folders.find((folder) => folder.id === row.id)?.parentId ?? null)
      : isPinned(snapshot, row)
        ? null
        : itemFolder(snapshot, row as { kind: 'bot' | 'room'; id: string })
  return home !== null && refusesFolder(snapshot, picked, home)
}

function stillThere(snapshot: RosterSnapshot, row: RosterRowRef): boolean {
  if (row.kind === 'bot') return snapshot.bots.some((bot) => bot.name === row.id)
  if (row.kind === 'room') return snapshot.rooms.some((room) => room.room_id === row.id)
  return true
}

// Talyx's own bot is never hidden or deleted.
function hasTalyx(rows: RosterRowRef[]): boolean {
  return rows.some((row) => row.kind === 'bot' && row.id === 'default')
}

function isPinned(snapshot: RosterSnapshot, row: RosterRowRef): boolean {
  return row.kind === 'bot'
    ? !!snapshot.bots.find((bot) => bot.name === row.id)?.meta.pinned
    : row.kind === 'room' && snapshot.roomPins.includes(row.id)
}

function botsOf(snapshot: RosterSnapshot, rows: RosterRowRef[]): Bot[] {
  return rows.flatMap((row) => {
    if (row.kind !== 'bot') return []
    const bot = snapshot.bots.find((item) => item.name === row.id)
    if (!bot) throw new RosterError('roster.errorProfileGone')
    return [bot]
  })
}
