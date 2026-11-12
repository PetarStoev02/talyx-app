import { MCP_TOOLS, isMcpTool } from '../../../../shared/mcp'
import type { McpAnswer, McpToolArgs, McpToolName } from '../../../../shared/mcp'
import { t } from '@shared/lib/i18n'
import type { TranslationKey } from '@shared/lib/i18n'
import { problemOf, problemText } from '@shared/lib/problem'
import { BLOCK_HUES, BLOCK_SHAPES } from '@shared/ui/blockGeometry'
import type { BlockShape } from '@shared/ui/blockGeometry'
import { refreshRoster, rosterActions, runRosterMutation } from './actions'
import { createBot, profileIdFor } from './create'
import type { RosterBackend } from './data'
import { MANAGER, confirmModel, loadDetails, saveDetails } from './details'
import type { DetailsDraft } from './details'
import { lookOf, matchName } from './look'
import type { Look } from './look'
import { createRoom } from './rooms'
import { RosterError, botTitle, itemFolder, itemKey } from './roster'
import {
  DEFAULT_SCHEDULE,
  addRoutine,
  listRoutines,
  removeRoutine,
  setRoutineActive
} from './routines'
import { useRoster } from './store'
import type { Bot, Room, RosterSnapshot } from './types'

/** What the user is asked in Talyx before a tool that loses data runs. */
export interface ApprovalRequest {
  tool: McpToolName
  /** What will happen, in the user's words. */
  action: string
}

/** Shows the request in Talyx; true only when the user allowed it. */
export type Approve = (request: ApprovalRequest) => Promise<boolean>

/** The user said no in Talyx: nothing was changed. */
export class ApprovalRefusedError extends RosterError {
  constructor() {
    super('mcp.refused')
    this.name = 'ApprovalRefusedError'
  }
}

type Run<T extends McpToolName> = (args: McpToolArgs<T>) => Promise<unknown>

/**
 * Runs one MCP tool call through the same use cases the roster, the details panel and the
 * routines use, so their rules (metadata revisions, avatar export, SOUL) stay in one place. A
 * roster change goes through the roster's mutation queue, so the roster shows it at once.
 */
export function mcpTools(
  backend: RosterBackend,
  approve: Approve
): (tool: string, rawArgs: unknown) => Promise<McpAnswer> {
  const tools = toolsFor(backend, approve)
  return async (tool, rawArgs) => {
    if (!isMcpTool(tool)) return { ok: false, text: `Unknown tool: ${tool}` }
    const args = MCP_TOOLS[tool].args.safeParse(rawArgs ?? {})
    if (!args.success) return { ok: false, text: `Invalid arguments: ${args.error.message}` }
    try {
      const result = await (tools[tool] as Run<typeof tool>)(args.data as never)
      return { ok: true, text: JSON.stringify(result ?? { ok: true }) }
    } catch (error) {
      return { ok: false, text: problemText((key) => t(key, 'en'), problemOf(error)) }
    }
  }
}

function toolsFor(backend: RosterBackend, approve: Approve): { [T in McpToolName]: Run<T> } {
  const actions = rosterActions(backend)
  const ask = async (tool: McpToolName, action: string): Promise<void> => {
    if (!(await approve({ tool, action }))) throw new ApprovalRefusedError()
  }
  const change = <T>(operation: (snapshot: RosterSnapshot) => Promise<T>): Promise<T> =>
    rosterChange(backend, operation)
  const fresh = async (): Promise<RosterSnapshot> => {
    await refreshRoster(backend)
    return useRoster.getState().snapshot
  }

  return {
    list_roster: async () => rosterView(await fresh()),
    list_looks: async () => ({ shapes: BLOCK_SHAPES, hues: BLOCK_HUES.length }),
    create_bot: ({ name, purpose, folderId, look }) =>
      change(async (snapshot) => {
        const taken = snapshot.bots.map((bot) => bot.name)
        const folder = folderId ? folderOf(snapshot, folderId) : null
        const id = profileIdFor(name, taken)
        const profile = await createBot(
          backend,
          {
            name,
            folder,
            model: null,
            look: look ? lookFrom(look) : { ...matchName(id), faces: true },
            purpose: purpose ?? null
          },
          taken
        )
        return { profile }
      }),
    // The user is asked before the change starts, so the roster is not held up while they decide.
    update_bot: async ({ profile, title, description, soul, model, look }) => {
      const bot = botOf(await fresh(), profile)
      const opening: DetailsDraft = {
        ...(await loadDetails(backend, profile)),
        title: botTitle(bot),
        look: lookOf(bot)
      }
      const draft: DetailsDraft = {
        title: title ?? opening.title,
        description: description ?? opening.description,
        soul: soul ?? opening.soul,
        model: model ?? opening.model,
        look: look ? lookFrom(look) : opening.look
      }
      if (draft.soul !== opening.soul)
        await ask('update_bot', say('mcp.replaceSoul', { name: botTitle(bot) }))
      const costly = await change((snapshot) =>
        saveDetails(backend, botOf(snapshot, profile), { opening, draft })
      )
      if (costly) {
        await ask(
          'update_bot',
          say('mcp.costlyModel', {
            name: botTitle(bot),
            model: costly.model.model,
            message: costly.message
          })
        )
        await confirmModel(backend, profile, costly.model)
      }
      return { profile }
    },
    set_reasoning: async ({ profile, level }) => {
      botOf(await fresh(), profile)
      await backend.http({
        path: `/api/config?${new URLSearchParams({ profile })}`,
        method: 'PUT',
        body: { config: { agent: { reasoning_effort: level } } },
        profile
      })
      return { profile, reasoning: level }
    },
    delete_bot: async ({ profile }) => {
      const bot = botOf(await fresh(), profile)
      if (bot.name === MANAGER) throw new RosterError('mcp.errorManager')
      await ask('delete_bot', say('mcp.deleteBot', { name: botTitle(bot) }))
      await change((snapshot) => actions.deleteProfile(botOf(snapshot, profile)))
      return { deleted: profile }
    },
    create_folder: ({ name, parentId }) =>
      change(async (snapshot) => {
        const before = new Set(snapshot.folders.map((folder) => folder.id))
        await actions.addFolder(name, parentId ?? null)
        await refreshRoster(backend)
        const made = useRoster.getState().snapshot.folders.find((folder) => !before.has(folder.id))
        return { folderId: made?.id ?? null }
      }),
    rename_folder: ({ folderId, name }) =>
      change(async () => {
        await actions.renameFolder(folderId, name)
        return { folderId, name }
      }),
    move_folder: ({ folderId, parentId, beforeId }) =>
      change(async () => {
        await actions.placeFolder({ id: folderId, parentId, beforeId: beforeId ?? null })
        return { folderId, parentId }
      }),
    delete_folder: async ({ folderId }) => {
      const folder = folderOf(await fresh(), folderId)
      await ask('delete_folder', say('mcp.deleteFolder', { name: folder.name }))
      await change(() => actions.deleteFolder(folderId))
      return { deleted: folderId }
    },
    move_item: ({ kind, id, folderId, before }) =>
      change(async (snapshot) => {
        if (kind === 'bot') botOf(snapshot, id)
        else roomOf(snapshot, id)
        if (folderId) folderOf(snapshot, folderId)
        await actions.placeItem({ kind, id }, { folderId, before: before ? itemKey(before) : null })
        return { kind, id, folderId }
      }),
    pin_item: ({ kind, id, pinned }) =>
      change(async (snapshot) => {
        if (kind === 'bot') {
          const bot = botOf(snapshot, id)
          if (!!bot.meta.pinned !== pinned) await actions.pin(bot)
        } else {
          const room = roomOf(snapshot, id)
          if (snapshot.roomPins.includes(id) !== pinned) await actions.pinRoom(room)
        }
        return { kind, id, pinned }
      }),
    create_room: ({ name, members }) =>
      change(async (snapshot) => ({
        roomId: await createRoom(backend, {
          name,
          members: members.map((profile) => botOf(snapshot, profile))
        })
      })),
    delete_room: async ({ roomId }) => {
      const room = roomOf(await fresh(), roomId)
      await ask('delete_room', say('mcp.deleteRoom', { name: room.name }))
      await change(async (snapshot) => {
        const current = roomOf(snapshot, roomId)
        await actions.deleteRoom(current)
        await actions.forgetRoom(current)
      })
      return { deleted: roomId }
    },
    list_routines: async ({ profile }) => {
      botOf(await fresh(), profile)
      return { routines: await listRoutines(backend, profile) }
    },
    add_routine: async ({ profile, name, instruction, schedule, postsToChat }) => {
      botOf(await fresh(), profile)
      await addRoutine(backend, profile, {
        name,
        instruction,
        schedule: { ...DEFAULT_SCHEDULE, ...schedule },
        postsToChat: postsToChat ?? false
      })
      return { routines: await listRoutines(backend, profile) }
    },
    set_routine_active: async ({ profile, routineId, active }) => {
      await routineOf(backend, profile, routineId)
      await setRoutineActive(backend, profile, { id: routineId, active })
      return { routineId, active }
    },
    delete_routine: async ({ profile, routineId }) => {
      const routine = await routineOf(backend, profile, routineId)
      await ask('delete_routine', say('mcp.deleteRoutine', { name: routine.name }))
      await removeRoutine(backend, profile, routineId)
      return { deleted: routineId }
    }
  }
}

/**
 * Runs a roster change in the roster's queue, on a snapshot read just before it, and hands its
 * outcome back to the agent instead of showing a failure in the user's roster.
 */
async function rosterChange<T>(
  backend: RosterBackend,
  operation: (snapshot: RosterSnapshot) => Promise<T>
): Promise<T> {
  // Set inside the queued operation; a box, since TypeScript does not follow the closure's writes.
  const box: { outcome: { value: T } | { error: unknown } } = {
    outcome: { error: new RosterError('error.unexpected') }
  }
  await runRosterMutation(backend, async () => {
    try {
      await refreshRoster(backend)
      box.outcome = { value: await operation(useRoster.getState().snapshot) }
    } catch (error) {
      box.outcome = { error }
    }
  })
  const { outcome } = box
  if ('error' in outcome) throw outcome.error
  return outcome.value
}

/** The roster as an agent reads it: ids to pass back, names to talk about. */
function rosterView(snapshot: RosterSnapshot): unknown {
  return {
    bots: snapshot.bots.map((bot) => ({
      profile: bot.name,
      title: botTitle(bot),
      folderId: itemFolder(snapshot, { kind: 'bot', id: bot.name }),
      pinned: !!bot.meta.pinned,
      hidden: !!bot.meta.hidden
    })),
    folders: snapshot.folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId ?? null
    })),
    rooms: snapshot.rooms.map((room) => ({
      roomId: room.room_id,
      name: room.name,
      members: room.members.map((member) => member.profile),
      folderId: itemFolder(snapshot, { kind: 'room', id: room.room_id }),
      pinned: snapshot.roomPins.includes(room.room_id)
    }))
  }
}

function botOf(snapshot: RosterSnapshot, profile: string): Bot {
  const bot = snapshot.bots.find((item) => item.name === profile)
  if (!bot) throw new RosterError('roster.errorProfileGone', profile)
  return bot
}

function roomOf(snapshot: RosterSnapshot, roomId: string): Room {
  const room = snapshot.rooms.find((item) => item.room_id === roomId)
  if (!room) throw new RosterError('mcp.errorRoomGone', roomId)
  return room
}

function folderOf(snapshot: RosterSnapshot, folderId: string): RosterSnapshot['folders'][number] {
  const folder = snapshot.folders.find((item) => item.id === folderId)
  if (!folder) throw new RosterError('roster.errorFolderGone', folderId)
  return folder
}

async function routineOf(
  backend: RosterBackend,
  profile: string,
  routineId: string
): Promise<{ name: string }> {
  const routine = (await listRoutines(backend, profile)).find((item) => item.id === routineId)
  if (!routine) throw new RosterError('mcp.errorRoutineGone', routineId)
  return routine
}

function lookFrom(look: { shape: string; hue: number; faces: boolean }): Look {
  if (!BLOCK_SHAPES.includes(look.shape as BlockShape) || look.hue >= BLOCK_HUES.length)
    throw new RosterError('mcp.errorLook')
  return { shape: look.shape as BlockShape, hue: look.hue, faces: look.faces }
}

function say(key: TranslationKey, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, value),
    t(key, 'en')
  )
}
