import { beforeEach, describe, expect, it } from 'vitest'
import { mcpTools } from '../../../src/renderer/src/features/bots/mcp'
import type { ApprovalRequest } from '../../../src/renderer/src/features/bots/mcp'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import { MCP_TOOLS } from '../../../src/shared/mcp'
import type { McpAnswer } from '../../../src/shared/mcp'
import { BOT_META_KEY, backendFor, engineDouble, pngOf } from './engineDouble'
import type { EngineDouble } from './engineDouble'

const REFUSED = 'The user said no in Talyx, so nothing was changed.'

let engine: EngineDouble
let asked: ApprovalRequest[]
let allow: boolean
let call: (tool: string, args?: unknown) => Promise<McpAnswer>

beforeEach(() => {
  useRoster.setState({
    snapshot: { bots: [], folders: [], rooms: [], roomFolders: {}, roomPins: [], itemOrder: {} },
    selection: null,
    actionError: null,
    loadError: null,
    saving: false,
    loading: true
  })
  // Talyx, and Analyst in the Team folder; one room with Analyst.
  engine = engineDouble()
  asked = []
  allow = true
  const run = mcpTools(backendFor(engine), async (request) => {
    asked.push(request)
    return allow
  })
  call = (tool, args = {}) => run(tool, args)
})

/** The tool's result, which must have succeeded. */
async function ok(tool: string, args: unknown = {}): Promise<Record<string, unknown>> {
  const answer = await call(tool, args)
  expect(answer.ok, answer.text).toBe(true)
  return JSON.parse(answer.text) as Record<string, unknown>
}

const metaOf = (profile: string): Record<string, unknown> =>
  engine.metadata[profile][BOT_META_KEY] as Record<string, unknown>
const roster = (): ReturnType<typeof useRoster.getState>['snapshot'] =>
  useRoster.getState().snapshot

describe('MCP tools', () => {
  describe('given any tool', () => {
    it('should refuse a tool Talyx does not have', async () => {
      expect(await call('format_disk')).toEqual({ ok: false, text: 'Unknown tool: format_disk' })
    })

    it('should refuse arguments that do not fit the tool, changing nothing', async () => {
      const answer = await call('create_bot', { name: '' })
      expect(answer.ok).toBe(false)
      expect(answer.text).toMatch(/^Invalid arguments/)
      expect(engine.created).toEqual([])
    })

    it.each(Object.keys(MCP_TOOLS).filter((tool) => 'destructive' in MCP_TOOLS[tool as never]))(
      'should mark %s as one that asks the user first',
      (tool) => {
        expect(['delete_bot', 'delete_folder', 'delete_room', 'delete_routine']).toContain(tool)
      }
    )
  })

  describe('list_roster', () => {
    it('should list the bots, folders and rooms with where each one is', async () => {
      expect(await ok('list_roster')).toEqual({
        bots: [
          { profile: 'default', title: 'Talyx', folderId: null, pinned: false, hidden: false },
          { profile: 'analyst', title: 'Analyst', folderId: 'team', pinned: false, hidden: false }
        ],
        folders: [{ id: 'team', name: 'Team', parentId: null }],
        rooms: [
          { roomId: 'room', name: 'Team room', members: ['analyst'], folderId: null, pinned: false }
        ]
      })
    })
  })

  describe('list_looks', () => {
    it('should list the shapes and how many hues a look can use', async () => {
      const looks = await ok('list_looks')
      expect(looks.shapes).toContain('cube')
      expect(looks.hues).toBeGreaterThan(0)
    })
  })

  describe('create_bot', () => {
    it('should create a filed bot with its look exported and show it in the roster at once', async () => {
      const look = { shape: 'tower', hue: 2, faces: false }
      expect(await ok('create_bot', { name: 'Scout', folderId: 'team', look })).toEqual({
        profile: 'scout'
      })
      expect(engine.created[0]).toMatchObject({ name: 'scout' })
      expect(metaOf('scout')).toMatchObject({ title: 'Scout', sectionId: 'team', shape: 'tower' })
      expect(engine.assets.at(-1)?.params.data).toBe(
        pngOf({ shape: 'tower', hue: 2, faces: false })
      )
      expect(roster().bots.map((bot) => bot.name)).toContain('scout')
    })

    it('should refuse a folder that does not exist, creating nothing', async () => {
      const answer = await call('create_bot', { name: 'Scout', folderId: 'gone' })
      expect(answer).toEqual({
        ok: false,
        text: 'That folder no longer exists. Refresh the roster. gone'
      })
      expect(engine.created).toEqual([])
    })

    it('should refuse a look Talyx does not have', async () => {
      const answer = await call('create_bot', {
        name: 'Scout',
        look: { shape: 'sphere', hue: 0, faces: true }
      })
      expect(answer.ok).toBe(false)
      expect(engine.created).toEqual([])
    })
  })

  describe('update_bot', () => {
    it('should change only the fields given, without asking', async () => {
      await ok('update_bot', { profile: 'analyst', title: 'Numbers', description: 'Counts' })
      expect(metaOf('analyst').title).toBe('Numbers')
      expect(engine.profiles.analyst).toMatchObject({ description: 'Counts', soul: '# Analyst' })
      expect(asked).toEqual([])
    })

    it('should replace the SOUL only once the user allows it', async () => {
      await ok('update_bot', { profile: 'analyst', soul: '# New' })
      expect(asked.map((request) => request.action)).toEqual([
        'Replace the SOUL of Analyst. The text it has now is lost.'
      ])
      expect(engine.profiles.analyst.soul).toBe('# New')
    })

    it('should keep the SOUL and every other field when the user says no', async () => {
      allow = false
      const answer = await call('update_bot', { profile: 'analyst', title: 'X', soul: '# New' })
      expect(answer).toEqual({ ok: false, text: REFUSED })
      expect(engine.profiles.analyst.soul).toBe('# Analyst')
      expect(metaOf('analyst').title).toBe('Analyst')
    })

    it('should switch to a costly model only once the user allows it', async () => {
      engine.expensiveModels.add('paid-model')
      await ok('update_bot', {
        profile: 'analyst',
        model: { provider: 'custom', model: 'paid-model' }
      })
      expect(asked[0].action).toBe('Switch Analyst to paid-model. The engine says: Costs more')
      expect(engine.profiles.analyst.model).toEqual({ provider: 'custom', model: 'paid-model' })
    })

    it('should keep the model when the user says no to its cost', async () => {
      engine.expensiveModels.add('paid-model')
      allow = false
      const answer = await call('update_bot', {
        profile: 'analyst',
        model: { provider: 'custom', model: 'paid-model' }
      })
      expect(answer).toEqual({ ok: false, text: REFUSED })
      expect(engine.profiles.analyst.model?.model).toBe('9-route-provider')
    })

    it('should refuse a bot that does not exist', async () => {
      expect((await call('update_bot', { profile: 'ghost', title: 'X' })).ok).toBe(false)
    })
  })

  describe('set_reasoning', () => {
    it('should set the bot’s default reasoning', async () => {
      await ok('set_reasoning', { profile: 'analyst', level: 'high' })
      expect(engine.reasoning.analyst).toBe('high')
    })
  })

  describe('delete_bot', () => {
    it('should delete the bot once the user allows it', async () => {
      expect(await ok('delete_bot', { profile: 'analyst' })).toEqual({ deleted: 'analyst' })
      expect(asked[0]).toEqual({
        tool: 'delete_bot',
        action: 'Delete the bot Analyst and everything it keeps. This cannot be undone.'
      })
      expect(engine.deleted).toEqual(['analyst'])
      expect(roster().bots.map((bot) => bot.name)).toEqual(['default'])
    })

    it('should keep the bot when the user says no', async () => {
      allow = false
      expect(await call('delete_bot', { profile: 'analyst' })).toEqual({ ok: false, text: REFUSED })
      expect(engine.deleted).toEqual([])
    })

    it('should never delete Talyx’s own bot, without asking', async () => {
      const answer = await call('delete_bot', { profile: 'default' })
      expect(answer).toEqual({ ok: false, text: 'Talyx’s own bot cannot be deleted.' })
      expect(asked).toEqual([])
    })
  })

  describe('folders', () => {
    it('should create a folder inside another and return its id', async () => {
      const { folderId } = await ok('create_folder', { name: 'Research', parentId: 'team' })
      expect(roster().folders).toContainEqual({ id: folderId, name: 'Research', parentId: 'team' })
    })

    it('should rename a folder', async () => {
      await ok('rename_folder', { folderId: 'team', name: 'Crew' })
      expect(roster().folders).toEqual([{ id: 'team', name: 'Crew' }])
    })

    it('should move a folder under another', async () => {
      const { folderId } = await ok('create_folder', { name: 'Research' })
      await ok('move_folder', { folderId, parentId: 'team' })
      expect(roster().folders.find((folder) => folder.id === folderId)?.parentId).toBe('team')
    })

    it('should delete a folder once the user allows it, moving its bots up', async () => {
      await ok('delete_folder', { folderId: 'team' })
      expect(asked[0].tool).toBe('delete_folder')
      expect(roster().folders).toEqual([])
      expect(metaOf('analyst').sectionId).toBeNull()
    })

    it('should keep the folder when the user says no', async () => {
      allow = false
      expect(await call('delete_folder', { folderId: 'team' })).toEqual({
        ok: false,
        text: REFUSED
      })
      expect(roster().folders).toEqual([{ id: 'team', name: 'Team' }])
      expect(metaOf('analyst').sectionId).toBe('team')
    })
  })

  describe('move_item and pin_item', () => {
    it('should put a bot in a folder and pin it, as a chat request would', async () => {
      const { profile } = await ok('create_bot', { name: 'Scout' })
      await ok('move_item', { kind: 'bot', id: profile, folderId: 'team' })
      await ok('pin_item', { kind: 'bot', id: profile, pinned: true })
      expect(metaOf('scout')).toMatchObject({ sectionId: 'team', pinned: true })
    })

    it('should order a bot in front of another in its folder', async () => {
      await ok('create_bot', { name: 'Scout', folderId: 'team' })
      await ok('move_item', {
        kind: 'bot',
        id: 'scout',
        folderId: 'team',
        before: { kind: 'bot', id: 'analyst' }
      })
      expect(roster().itemOrder.team).toEqual(['bot:scout', 'bot:analyst'])
    })

    it('should leave a pin as it is when it already matches', async () => {
      await ok('pin_item', { kind: 'bot', id: 'analyst', pinned: false })
      expect(engine.configureCalls).toEqual([])
    })

    it('should pin and unpin a room', async () => {
      await ok('pin_item', { kind: 'room', id: 'room', pinned: true })
      expect(roster().roomPins).toEqual(['room'])
      await ok('pin_item', { kind: 'room', id: 'room', pinned: false })
      expect(roster().roomPins).toEqual([])
    })

    it('should refuse a room that does not exist', async () => {
      const answer = await call('move_item', { kind: 'room', id: 'gone', folderId: null })
      expect(answer).toEqual({ ok: false, text: 'That room no longer exists. gone' })
    })
  })

  describe('rooms', () => {
    it('should create a room with the bots named', async () => {
      const { roomId } = await ok('create_room', { name: 'Desk', members: ['default', 'analyst'] })
      expect(engine.rooms.find((room) => room.room_id === roomId)?.name).toBe('Desk')
    })

    it('should refuse a room with too few bots', async () => {
      const answer = await call('create_room', { name: 'Desk', members: ['analyst'] })
      expect(answer).toEqual({ ok: false, text: 'A room needs 2 to 6 bots.' })
    })

    it('should delete a room once the user allows it', async () => {
      await ok('pin_item', { kind: 'room', id: 'room', pinned: true })
      await ok('delete_room', { roomId: 'room' })
      expect(asked[0].action).toBe(
        'Delete the room Team room and its history. Its bots and their own chats stay.'
      )
      expect(engine.rooms).toEqual([])
      expect(roster().roomPins).toEqual([])
    })

    it('should keep the room when the user says no', async () => {
      allow = false
      expect(await call('delete_room', { roomId: 'room' })).toEqual({ ok: false, text: REFUSED })
      expect(engine.rooms).toHaveLength(1)
    })
  })

  describe('routines', () => {
    const addCash = (): Promise<Record<string, unknown>> =>
      ok('add_routine', {
        profile: 'analyst',
        name: 'Cash',
        instruction: 'Check cash',
        schedule: { kind: 'daily', time: '08:30' },
        postsToChat: true
      })

    it('should add a routine and list it', async () => {
      await addCash()
      expect(engine.cronCalls.find((item) => item.params.action === 'add')?.params).toMatchObject({
        schedule: '30 8 * * *',
        prompt: 'Check cash',
        deliver: 'bot-chat'
      })
      expect(await ok('list_routines', { profile: 'analyst' })).toEqual({
        routines: [
          { id: 'job-1', name: 'Cash', schedule: '30 8 * * *', active: true, postsToChat: true }
        ]
      })
    })

    it('should pause a routine', async () => {
      await addCash()
      await ok('set_routine_active', { profile: 'analyst', routineId: 'job-1', active: false })
      expect(engine.jobs.analyst[0].state).toBe('paused')
    })

    it('should delete a routine once the user allows it', async () => {
      await addCash()
      await ok('delete_routine', { profile: 'analyst', routineId: 'job-1' })
      expect(asked[0].action).toBe('Delete the routine Cash. This cannot be undone.')
      expect(engine.jobs.analyst).toEqual([])
    })

    it('should keep the routine when the user says no', async () => {
      await addCash()
      allow = false
      const answer = await call('delete_routine', { profile: 'analyst', routineId: 'job-1' })
      expect(answer).toEqual({ ok: false, text: REFUSED })
      expect(engine.jobs.analyst).toHaveLength(1)
    })

    it('should refuse a routine that does not exist', async () => {
      const answer = await call('set_routine_active', {
        profile: 'analyst',
        routineId: 'job-9',
        active: true
      })
      expect(answer).toEqual({ ok: false, text: 'That routine no longer exists. job-9' })
    })
  })
})
