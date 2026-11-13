import { z } from 'zod'
import { metaPatch } from '@shared/engine/botMeta'
import type { RosterBackend, RosterStore } from '@features/bots/data'
import type { Look } from '@features/bots/look'
import type { RoomsBackend, RoomSeat } from '@features/bots/rooms'
import { RosterError } from '@features/bots/roster'
import type { RulesBackend } from '@features/bots/rules'
import type { Room } from '@features/bots/types'
import type { EngineAccess } from './access'
import { engineDetailsBackend } from './details'
import { engineMcpBackend } from './mcp'
import { engineRoutinesBackend } from './routines'

/** What the roster needs beside the engine's socket and REST. */
export interface RosterHost {
  /** The engine's metadata keys for a bot's record and for its own client's room projection. */
  botMetaKey: string
  botGroupsMetaKey: string
  deleteProfile: (profile: string) => Promise<void>
  /** Changes an existing room's members in place (Talyx's engine plugin; the engine has no call). */
  setRoomMembers: (roomId: string, members: RoomMemberRecord[]) => Promise<void>
  // The block as a PNG data URL, for the profile's avatar image.
  avatarPng: (look: Look) => Promise<string>
}

/** A room member as the engine stores it, the shape `groups.create` takes. */
export interface RoomMemberRecord {
  member_id: string
  profile: string
  handle: string
  display_name: string
  target: { kind: 'local'; profile: string }
}

type RoomFolders = Record<string, string | null>

// Other clients write these records too: a bad field is dropped, never the whole roster.
const lenient = <T extends z.ZodType>(schema: T): z.ZodCatch<z.ZodOptional<T>> =>
  schema.optional().catch(undefined)
const jsonObject = z.record(z.string(), z.unknown())
const preview = z
  .object({
    id: lenient(z.string()),
    resolved_id: lenient(z.string()),
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
    hidden: lenient(z.boolean()),
    shape: lenient(z.string()),
    color: lenient(z.union([z.number().finite(), z.string()])),
    faces: lenient(z.boolean()),
    usesDefault: lenient(z.boolean())
  })
  .catch({})
const profilesSchema = z.object({ profiles: z.array(profileSchema) })
type ProfileRow = z.infer<typeof profileSchema>
const roomsSchema = z.object({
  rooms: z.array(
    z.object({
      room_id: z.string().min(1),
      name: z.string(),
      members: z.array(
        z.object({
          profile: z.string(),
          member_id: z.string().optional(),
          handle: z.string().optional(),
          display_name: z.string().optional()
        })
      ),
      disbanded_at: z.number().nullable().optional(),
      latest_seq: lenient(z.number().int().nonnegative())
    })
  ),
  next_offset: z.number().int().nonnegative().nullable()
})
const saveSchema = z.object({
  applied: z.object({ ui_meta: z.boolean().optional(), ui_meta_conflicts: jsonObject.optional() })
})
const roomProjectionSchema = z.object({
  rooms: z.record(
    z.string(),
    z.object({ roomId: z.string().optional(), sectionId: z.string().nullable().optional() })
  )
})

/** The bots feature's backend over the engine. */
export function engineRosterBackend(engine: EngineAccess, host: RosterHost): RosterBackend {
  return {
    ...engineRosterStore(engine, host),
    ...engineRoomsBackend(engine, host),
    ...engineRulesBackend(engine),
    ...engineDetailsBackend(engine),
    ...engineRoutinesBackend(engine),
    ...engineMcpBackend(engine),
    setAvatar: async (profile, look) => {
      await engine.request(profile, 'profiles.set_asset', {
        name: profile,
        asset: 'avatar',
        data: await host.avatarPng(look)
      })
    },
    createProfile: async ({ id, soul, description }) => {
      await engine.request('default', 'profiles.create', {
        name: id,
        soul,
        ...(description ? { description } : {})
      })
    }
  }
}

function engineRosterStore(engine: EngineAccess, host: RosterHost): RosterStore {
  return {
    listBots: async () => {
      const { profiles } = profilesSchema.parse(
        await engine.request('default', 'profiles.list', { include_sessions: true })
      )
      return profiles.map((bot) => ({
        ...bot,
        meta: metaSchema.parse(bot.ui_meta?.[host.botMetaKey])
      }))
    },
    listRooms: () => readRooms(engine),
    olderRoomFolders: (manager, rooms) =>
      recoverRoomFolders(manager.ui_meta?.[host.botGroupsMetaKey], rooms),
    saveBotMeta: (profile, patch) =>
      updateMetadata(engine, profile, (meta) => ({
        [host.botMetaKey]: {
          // A value no client can read is replaced rather than blocking every later save.
          ...jsonObject.catch({}).parse(meta[host.botMetaKey]),
          ...patch
        }
      })),
    updateLayout: (update) => updateMetadata(engine, 'default', update),
    deleteProfile: host.deleteProfile,
    deleteRoom: async (roomId) => {
      await engine.request('default', 'groups.disband', {
        room_id: roomId,
        cancel_id: crypto.randomUUID()
      })
    }
  }
}

function engineRoomsBackend(engine: EngineAccess, host: RosterHost): RoomsBackend {
  return {
    seatableProfiles: async () => {
      const { seatable_profiles: seatable } = await engine.request<{
        seatable_profiles?: string[] | null
      }>('default', 'groups.capabilities', {})
      return Array.isArray(seatable) ? seatable : null
    },
    createRoom: async ({ roomId, name, seats }) => {
      await engine.request('default', 'groups.create', {
        room_id: roomId,
        name,
        members: seats.map(memberRecord)
      })
    },
    setRoomMembers: (roomId, seats) => host.setRoomMembers(roomId, seats.map(memberRecord)),
    renameRoom: async ({ roomId, name }) => {
      await engine.request('default', 'groups.rename', {
        room_id: roomId,
        event_id: crypto.randomUUID(),
        name
      })
    }
  }
}

interface ProfileConfig {
  agent?: { system_prompt?: unknown }
}

// The prompt setting is `agent.system_prompt`, which the engine adds to the bot's instructions.
function engineRulesBackend(engine: EngineAccess): RulesBackend {
  const configPath = (profile: string): string => `/api/config?${new URLSearchParams({ profile })}`
  return {
    readPrompt: async (profile) => {
      const config = await engine.http<ProfileConfig>({
        path: `${configPath(profile)}&include_defaults=false`,
        profile
      })
      return config.agent?.system_prompt
    },
    writePrompt: async (profile, prompt) => {
      await engine.http({
        path: configPath(profile),
        method: 'PUT',
        body: { config: { agent: { system_prompt: prompt } } },
        profile
      })
    }
  }
}

function memberRecord(seat: RoomSeat): RoomMemberRecord {
  return {
    member_id: seat.profile,
    profile: seat.profile,
    handle: seat.handle,
    display_name: seat.name,
    target: { kind: 'local', profile: seat.profile }
  }
}

// Read-modify-CAS preserves fields owned by other screens and concurrent desktops. The keys
// `update` returns are written in one save: the engine takes all of them or none.
async function updateMetadata(
  engine: EngineAccess,
  profile: string,
  update: (meta: Record<string, unknown>) => Record<string, unknown>
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const bot = await readMetadata(engine, profile)
    const revisions = bot.ui_meta_revisions
    if (!revisions) throw new RosterError('roster.errorUnsafeSave')
    const meta = update(bot.ui_meta ?? {})
    const result = saveSchema.parse(
      await engine.request(
        profile,
        'profiles.configure',
        metaPatch(
          profile,
          Object.fromEntries(
            Object.entries(meta).map(([key, value]) => [
              key,
              { meta: value, revision: revisions[key] ?? 0 }
            ])
          )
        )
      )
    )
    if (result.applied.ui_meta === true) return
    if (!result.applied.ui_meta_conflicts) throw new RosterError('roster.errorNotSaved')
  }
  throw new RosterError('roster.errorConflict')
}

// The CAS read needs only metadata and revisions, so it skips the session previews.
async function readMetadata(engine: EngineAccess, profile: string): Promise<ProfileRow> {
  const { profiles } = profilesSchema.parse(
    await engine.request(profile, 'profiles.list', { include_sessions: false })
  )
  const bot = profiles.find((item) => item.name === profile)
  if (!bot) throw new RosterError('roster.errorProfileGone')
  return bot
}

async function readRooms(engine: EngineAccess): Promise<Room[]> {
  const rooms: Room[] = []
  let offset = 0
  for (;;) {
    const page = roomsSchema.parse(
      await engine.request('default', 'groups.list', { limit: 100, offset })
    )
    rooms.push(...page.rooms.filter((room) => !room.disbanded_at))
    if (page.next_offset === null) return rooms
    if (page.next_offset <= offset) throw new RosterError('roster.errorRoomCursor')
    offset = page.next_offset
  }
}

// The engine's own client files rooms in its projection on Talyx's profile.
function recoverRoomFolders(value: unknown, rooms: Room[]): RoomFolders {
  const projection = roomProjectionSchema.safeParse(value)
  if (!projection.success) return {}
  const byId = new Map(rooms.map((room) => [room.room_id, room]))
  return Object.fromEntries(
    Object.values(projection.data.rooms).flatMap((room) =>
      room.roomId && byId.has(room.roomId) && room.sectionId ? [[room.roomId, room.sectionId]] : []
    )
  )
}
