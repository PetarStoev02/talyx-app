import { z } from 'zod'
import {
  FOLDERS_KEY,
  ROOM_FOLDERS_KEY,
  ROOM_PINS_KEY,
  ITEM_ORDER_KEY,
  RosterError,
  normalizeFolders,
  recoverFolders
} from './roster'
import type { CreateBackend } from './create'
import type { DetailsBackend } from './details'
import type { AvatarBackend } from './look'
import type { McpToolsBackend } from './mcp'
import type { McpServersBackend } from './mcpRegistration'
import type { RoomsBackend } from './rooms'
import type { RoutinesBackend } from './routines'
import type { RulesBackend } from './rules'
import type { Bot, BotMeta, Folder, Room, RosterSnapshot } from './types'

/** The roster's records: its bots, its rooms and the shared layout on Talyx's own profile. */
export interface RosterStore {
  /** Every bot, with its metadata and its chats' previews. */
  listBots: () => Promise<Bot[]>
  /** The rooms that are not disbanded. */
  listRooms: () => Promise<Room[]>
  /** Room folders another client filed on Talyx's profile before the shared layout, for `rooms`. */
  olderRoomFolders: (manager: Bot, rooms: Room[]) => RoomFolders
  /** Merges `patch` into the bot's metadata, keeping the fields other clients wrote. */
  saveBotMeta: (profile: string, patch: Partial<BotMeta>) => Promise<void>
  /**
   * Changes Talyx's own records on its profile: `update` gets what is stored, by key, and returns
   * the keys to write. All are written or none, read again when another client wrote meanwhile.
   */
  updateLayout: (
    update: (stored: Record<string, unknown>) => Record<string, unknown>
  ) => Promise<void>
  deleteProfile: (profile: string) => Promise<void>
  deleteRoom: (roomId: string) => Promise<void>
}

/** Everything the bots feature asks of the engine, as one object for the wiring to build. */
export type RosterBackend = RosterStore &
  CreateBackend &
  AvatarBackend &
  RoomsBackend &
  DetailsBackend &
  RoutinesBackend &
  RulesBackend &
  McpServersBackend &
  McpToolsBackend

type RoomFolders = Record<string, string | null>

const roomFoldersSchema = z.record(z.string(), z.string().nullable())
const roomPinsSchema = z.array(z.string()).catch([])
const itemOrderSchema = z.record(z.string(), z.array(z.string())).catch({})

export async function readRoster(
  backend: Pick<RosterStore, 'listBots' | 'listRooms' | 'olderRoomFolders'>
): Promise<RosterSnapshot> {
  const [bots, rooms] = await Promise.all([backend.listBots(), backend.listRooms()])
  const manager = managerOf(bots)
  const storedFolders = manager.ui_meta?.[FOLDERS_KEY]
  const folders =
    storedFolders === undefined ? recoverFolders(bots) : normalizeFolders(storedFolders)
  const storedRoomFolders = roomFoldersSchema.safeParse(manager.ui_meta?.[ROOM_FOLDERS_KEY])
  const roomFolders = storedRoomFolders.success
    ? storedRoomFolders.data
    : backend.olderRoomFolders(manager, rooms)
  const roomPins = roomPinsSchema.parse(manager.ui_meta?.[ROOM_PINS_KEY] ?? [])
  const itemOrder = itemOrderSchema.parse(manager.ui_meta?.[ITEM_ORDER_KEY] ?? {})
  return { bots, rooms, folders, roomFolders, roomPins, itemOrder }
}

export function hasSharedLayout(snapshot: RosterSnapshot): boolean {
  return managerOf(snapshot.bots).ui_meta?.[FOLDERS_KEY] !== undefined
}

// First run: write the folders recovered from sectionId so every client shares one layout.
export function publishRecoveredLayout(
  backend: Pick<RosterStore, 'updateLayout'>,
  snapshot: RosterSnapshot
): Promise<void> {
  return saveFolders(backend, (folders) => folders, snapshot.folders)
}

export function saveBotMeta(
  backend: Pick<RosterStore, 'saveBotMeta'>,
  profile: string,
  patch: Partial<BotMeta>
): Promise<void> {
  return backend.saveBotMeta(profile, patch)
}

export function saveFolders(
  backend: Pick<RosterStore, 'updateLayout'>,
  update: (folders: Folder[]) => Folder[],
  fallback: Folder[]
): Promise<void> {
  return saveLayout(backend, { folders: fallback, roomFolders: {} }, (layout) => ({
    folders: update(layout.folders)
  }))
}

export function saveRoomFolders(
  backend: Pick<RosterStore, 'updateLayout'>,
  update: (roomFolders: RoomFolders) => RoomFolders,
  fallback: RoomFolders
): Promise<void> {
  return saveLayout(backend, { folders: [], roomFolders: fallback }, (layout) => ({
    roomFolders: update(layout.roomFolders)
  }))
}

export function saveItemOrder(
  backend: Pick<RosterStore, 'updateLayout'>,
  update: (order: Record<string, string[]>) => Record<string, string[]>
): Promise<void> {
  return saveLayout(backend, { folders: [], roomFolders: {} }, (layout) => ({
    itemOrder: update(layout.itemOrder)
  }))
}

export function saveRoomPins(
  backend: Pick<RosterStore, 'updateLayout'>,
  update: (roomPins: string[]) => string[]
): Promise<void> {
  return saveLayout(backend, { folders: [], roomFolders: {} }, (layout) => ({
    roomPins: update(layout.roomPins)
  }))
}

/** The shared layout on the manager profile: folders, room folders, room pins and the order. */
export type Layout = Pick<RosterSnapshot, 'folders' | 'roomFolders' | 'roomPins' | 'itemOrder'>

const LAYOUT_KEYS: Record<keyof Layout, string> = {
  folders: FOLDERS_KEY,
  roomFolders: ROOM_FOLDERS_KEY,
  roomPins: ROOM_PINS_KEY,
  itemOrder: ITEM_ORDER_KEY
}

/**
 * Changes the shared layout in one revision-checked save: every part `update` returns is written,
 * or none. `fallback` stands in for folders and room folders no client has written yet.
 */
export function saveLayout(
  backend: Pick<RosterStore, 'updateLayout'>,
  fallback: Pick<Layout, 'folders' | 'roomFolders'>,
  update: (layout: Layout) => Partial<Layout>
): Promise<void> {
  return backend.updateLayout((meta) => {
    const storedRoomFolders = roomFoldersSchema.safeParse(meta[ROOM_FOLDERS_KEY])
    const changes = update({
      folders:
        meta[FOLDERS_KEY] === undefined ? fallback.folders : normalizeFolders(meta[FOLDERS_KEY]),
      roomFolders: storedRoomFolders.success ? storedRoomFolders.data : fallback.roomFolders,
      roomPins: roomPinsSchema.parse(meta[ROOM_PINS_KEY] ?? []),
      itemOrder: itemOrderSchema.parse(meta[ITEM_ORDER_KEY] ?? {})
    })
    return Object.fromEntries(
      Object.entries(changes).map(([part, value]) => [LAYOUT_KEYS[part as keyof Layout], value])
    )
  })
}

function managerOf(bots: Bot[]): Bot {
  const manager = bots.find((bot) => bot.name === 'default')
  if (!manager) throw new RosterError('roster.errorNoDefault')
  return manager
}
