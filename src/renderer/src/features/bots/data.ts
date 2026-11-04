import { z } from 'zod'
import { metaPatch } from '@shared/engine/botMeta'
import {
  FOLDERS_KEY,
  ROOM_FOLDERS_KEY,
  RosterError,
  normalizeFolders,
  recoverFolders
} from './roster'
import type { Bot, BotMeta, Folder, Room, RosterSnapshot } from './types'

export interface RosterBackend {
  request: RosterRequest
  botMetaKey: string
  botGroupsMetaKey: string
  deleteProfile: (profile: string) => Promise<void>
}

export type RosterRequest = (
  profile: string,
  method: string,
  params: Record<string, unknown>
) => Promise<unknown>

type RoomFolders = Record<string, string | null>

// Other clients write these records too: a bad field is dropped, never the whole roster.
const lenient = <T extends z.ZodType>(schema: T): z.ZodCatch<z.ZodOptional<T>> =>
  schema.optional().catch(undefined)
const jsonObject = z.record(z.string(), z.unknown())
const preview = z
  .object({
    last_active: lenient(z.number().finite()),
    preview: lenient(z.string())
  })
  .nullable()
  .optional()
  .catch(null)
const profileSchema = z.object({
  name: z.string().min(1),
  display_name: lenient(z.string()),
  title: lenient(z.string().nullable()),
  description: lenient(z.string()),
  canonical_session: preview,
  last_session: preview,
  ui_meta: jsonObject.optional(),
  ui_meta_revisions: z.record(z.string(), z.number().int().nonnegative()).optional()
})
const metaSchema = z
  .object({
    title: lenient(z.string()),
    description: lenient(z.string()),
    sectionId: lenient(z.string().nullable()),
    sectionName: lenient(z.string().nullable()),
    pinned: lenient(z.boolean()),
    pinnedOrder: lenient(z.number().finite()),
    hidden: lenient(z.boolean())
  })
  .catch({})
const roomFoldersSchema = z.record(z.string(), z.string().nullable())
const profilesSchema = z.object({ profiles: z.array(profileSchema) })
type ProfileRow = z.infer<typeof profileSchema>
const roomsSchema = z.object({
  rooms: z.array(
    z.object({
      room_id: z.string().min(1),
      name: z.string(),
      members: z.array(z.object({ profile: z.string(), display_name: z.string().optional() })),
      disbanded_at: z.number().nullable().optional()
    })
  ),
  next_offset: z.number().int().nonnegative().nullable()
})
const saveSchema = z.object({
  applied: z.object({ ui_meta: z.boolean().optional(), ui_meta_conflicts: jsonObject.optional() })
})

export async function readRoster(backend: RosterBackend): Promise<RosterSnapshot> {
  const [bots, rooms] = await Promise.all([readProfiles(backend), readRooms(backend.request)])
  const manager = managerOf(bots)
  const storedFolders = manager.ui_meta?.[FOLDERS_KEY]
  const folders =
    storedFolders === undefined ? recoverFolders(bots) : normalizeFolders(storedFolders)
  const storedRoomFolders = roomFoldersSchema.safeParse(manager.ui_meta?.[ROOM_FOLDERS_KEY])
  const roomFolders = storedRoomFolders.success
    ? storedRoomFolders.data
    : recoverRoomFolders(manager.ui_meta?.[backend.botGroupsMetaKey], rooms)
  return { bots, rooms, folders, roomFolders }
}

export function hasSharedLayout(snapshot: RosterSnapshot): boolean {
  return managerOf(snapshot.bots).ui_meta?.[FOLDERS_KEY] !== undefined
}

// First run: write the folders recovered from sectionId so every client shares one layout.
export function publishRecoveredLayout(
  backend: RosterBackend,
  snapshot: RosterSnapshot
): Promise<void> {
  return saveFolders(backend, (folders) => folders, snapshot.folders)
}

export function saveBotMeta(
  backend: RosterBackend,
  profile: string,
  patch: Partial<BotMeta>
): Promise<void> {
  return updateMetadata(backend, { profile, key: backend.botMetaKey }, (value) => ({
    // A value no client can read is replaced rather than blocking every later save.
    ...jsonObject.catch({}).parse(value),
    ...patch
  }))
}

export function saveFolders(
  backend: RosterBackend,
  update: (folders: Folder[]) => Folder[],
  fallback: Folder[]
): Promise<void> {
  return updateMetadata(backend, { profile: 'default', key: FOLDERS_KEY }, (value) =>
    update(value === undefined ? fallback : normalizeFolders(value))
  )
}

export function saveRoomFolders(
  backend: RosterBackend,
  update: (roomFolders: RoomFolders) => RoomFolders,
  fallback: RoomFolders
): Promise<void> {
  return updateMetadata(backend, { profile: 'default', key: ROOM_FOLDERS_KEY }, (value) => {
    const stored = roomFoldersSchema.safeParse(value)
    return update(stored.success ? stored.data : fallback)
  })
}

// Read-modify-CAS preserves fields owned by other screens and concurrent desktops.
async function updateMetadata(
  backend: RosterBackend,
  target: { profile: string; key: string },
  update: (value: unknown) => unknown
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const bot = await readMetadata(backend, target.profile)
    if (!bot.ui_meta_revisions) throw new RosterError('roster.errorUnsafeSave')
    const result = saveSchema.parse(
      await backend.request(
        target.profile,
        'profiles.configure',
        metaPatch(target.profile, target.key, {
          meta: update(bot.ui_meta?.[target.key]),
          revision: bot.ui_meta_revisions[target.key] ?? 0
        })
      )
    )
    if (result.applied.ui_meta === true) return
    if (!result.applied.ui_meta_conflicts) throw new RosterError('roster.errorNotSaved')
  }
  throw new RosterError('roster.errorConflict')
}

async function readProfiles(backend: RosterBackend): Promise<Bot[]> {
  const { profiles } = profilesSchema.parse(
    await backend.request('default', 'profiles.list', { include_sessions: true })
  )
  return profiles.map((bot) => ({
    ...bot,
    meta: metaSchema.parse(bot.ui_meta?.[backend.botMetaKey])
  }))
}

// The CAS read needs only metadata and revisions, so it skips the session previews.
async function readMetadata(backend: RosterBackend, profile: string): Promise<ProfileRow> {
  const { profiles } = profilesSchema.parse(
    await backend.request(profile, 'profiles.list', { include_sessions: false })
  )
  const bot = profiles.find((item) => item.name === profile)
  if (!bot) throw new RosterError('roster.errorProfileGone')
  return bot
}

async function readRooms(request: RosterRequest): Promise<Room[]> {
  const rooms: Room[] = []
  let offset = 0
  for (;;) {
    const page = roomsSchema.parse(await request('default', 'groups.list', { limit: 100, offset }))
    rooms.push(...page.rooms.filter((room) => !room.disbanded_at))
    if (page.next_offset === null) return rooms
    if (page.next_offset <= offset) throw new RosterError('roster.errorRoomCursor')
    offset = page.next_offset
  }
}

function managerOf(bots: Bot[]): Bot {
  const manager = bots.find((bot) => bot.name === 'default')
  if (!manager) throw new RosterError('roster.errorNoDefault')
  return manager
}

function recoverRoomFolders(value: unknown, rooms: Room[]): RoomFolders {
  const projection = z
    .object({
      rooms: z.record(
        z.string(),
        z.object({ roomId: z.string().optional(), sectionId: z.string().nullable().optional() })
      )
    })
    .safeParse(value)
  if (!projection.success) return {}
  const byId = new Map(rooms.map((room) => [room.room_id, room]))
  return Object.fromEntries(
    Object.values(projection.data.rooms).flatMap((room) =>
      room.roomId && byId.has(room.roomId) && room.sectionId ? [[room.roomId, room.sectionId]] : []
    )
  )
}
