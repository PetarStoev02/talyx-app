import fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import { mcpTools } from '../../../src/renderer/src/features/bots/mcp'
import type { ApprovalRequest } from '../../../src/renderer/src/features/bots/mcp'
import { lookOf } from '../../../src/renderer/src/features/bots/look'
import { botTitle, pinnedBots } from '../../../src/renderer/src/features/bots/roster'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import { t } from '../../../src/renderer/src/shared/lib/i18n'
import { MCP_TEXT_MAX, mcpToolList } from '../../../src/shared/mcp'
import type { McpAnswer } from '../../../src/shared/mcp'
import { BOT_META_KEY, backendFor, engineDouble, pngOf } from './engineDouble'
import type { EngineDouble } from './engineDouble'

const REFUSED = 'The user said no in Talyx, so nothing was changed.'

let engine: EngineDouble
let asked: ApprovalRequest[]
let allow: boolean
let call: (tool: string, args?: unknown) => Promise<McpAnswer>

beforeEach(setUp)

function setUp(): void {
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
}

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

    it('should mark exactly the tools that delete as destructive to agents', () => {
      expect(
        mcpToolList()
          .filter((tool) => tool.annotations.destructiveHint)
          .map((tool) => tool.name)
      ).toEqual([
        'delete_bot',
        'delete_folder',
        'delete_room',
        'delete_routine',
        'delete_memory',
        'delete_skill'
      ])
    })
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
        'Replace the SOUL of “Analyst”. The text it has now is lost.'
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
      expect(asked[0].action).toBe('Switch “Analyst” to paid-model. The engine says: Costs more')
      expect(engine.profiles.analyst.model).toEqual({ provider: 'custom', model: 'paid-model' })
    })

    it('should give both questions of one call the same deadline', async () => {
      engine.expensiveModels.add('paid-model')
      await ok('update_bot', {
        profile: 'analyst',
        soul: '# New',
        model: { provider: 'custom', model: 'paid-model' }
      })
      expect(asked).toHaveLength(2)
      expect(asked[1].until).toBe(asked[0].until)
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

    it('should say the other fields were saved when the user says no to a costly model', async () => {
      engine.expensiveModels.add('paid-model')
      allow = false
      const answer = await call('update_bot', {
        profile: 'analyst',
        title: 'Numbers',
        model: { provider: 'custom', model: 'paid-model' }
      })
      expect(answer).toEqual({
        ok: false,
        text: 'The user said no in Talyx to the model, so it did not change. The other changes in this call were saved.'
      })
      expect(metaOf('analyst').title).toBe('Numbers')
      expect(engine.profiles.analyst.model?.model).toBe('9-route-provider')
    })

    it('should say the other fields were saved exactly when one was, when the user says no to a costly model', async () => {
      // Each field: left out, given as it is, given with stray spaces, or changed.
      const given = fc.record({
        title: fc.constantFrom('', 'same', 'padded', 'Numbers'),
        description: fc.constantFrom('', 'same', 'padded', 'Counts things'),
        look: fc.constantFrom('', 'same', 'shape', 'face')
      })
      const profile = fc.constantFrom('analyst', 'default')
      await fc.assert(
        fc.asyncProperty(profile, fc.boolean(), given, async (name, usesDefault, fields) => {
          setUp()
          engine.expensiveModels.add('paid-model')
          allow = false
          const meta = { ...(engine.metadata[name][BOT_META_KEY] as object), usesDefault }
          engine.metadata[name][BOT_META_KEY] = meta
          const bot = { name, meta }
          const look = lookOf(bot)
          const value = (field: string, same: string): string | undefined =>
            field === ''
              ? undefined
              : field === 'same'
                ? same
                : field === 'padded'
                  ? ` ${same} `
                  : field
          const args = {
            profile: name,
            title: value(fields.title, botTitle(bot)),
            description: value(fields.description, engine.profiles[name].description),
            look: {
              '': undefined,
              same: look,
              shape: { ...look, shape: 'tower' },
              face: { ...look, faces: !look.faces }
            }[fields.look],
            model: { provider: 'custom', model: 'paid-model' }
          }
          const model = engine.profiles[name].model
          // Everything the save can write besides the model.
          const stored = (): string =>
            JSON.stringify([
              engine.metadata[name],
              { ...engine.profiles[name], model: null },
              engine.assets
            ])
          const before = stored()
          const answer = await call('update_bot', args)
          expect(engine.profiles[name].model).toEqual(model)
          expect(answer).toEqual({
            ok: false,
            text: stored() === before ? REFUSED : t('mcp.refusedModel', 'en')
          })
        })
      )
    })

    it('should refuse a bot that does not exist', async () => {
      expect((await call('update_bot', { profile: 'ghost', title: 'X' })).ok).toBe(false)
    })

    it('should take a bot off "Uses default" when it is given a model of its own', async () => {
      engine.metadata.analyst[BOT_META_KEY] = { title: 'Analyst', usesDefault: true }
      await ok('update_bot', { profile: 'analyst', model: { provider: 'custom', model: 'own' } })
      expect(metaOf('analyst').usesDefault).toBeUndefined()
    })

    it('should move the bots on "Uses default" when Talyx gets a new model', async () => {
      engine.metadata.analyst[BOT_META_KEY] = { title: 'Analyst', usesDefault: true }
      const next = { provider: 'openai', model: 'gpt-5-mini' }
      expect(await ok('update_bot', { profile: 'default', model: next })).toEqual({
        profile: 'default'
      })
      expect(engine.profiles.analyst.model).toEqual(next)
    })

    it('should move the bots on "Uses default" when Talyx\'s model changed but another field was refused', async () => {
      engine.metadata.analyst[BOT_META_KEY] = { title: 'Analyst', usesDefault: true }
      engine.failSection('soul')
      const next = { provider: 'openai', model: 'gpt-5-mini' }
      const answer = await call('update_bot', { profile: 'default', soul: '# New', model: next })
      expect(answer.ok).toBe(false)
      expect(engine.profiles.analyst.model).toEqual(next)
    })

    it('should name the bots left on the old model when another field of Talyx was refused', async () => {
      engine.metadata.analyst[BOT_META_KEY] = { title: 'Analyst', usesDefault: true }
      engine.failSection('soul')
      engine.refuseModelOn.add('analyst')
      const next = { provider: 'openai', model: 'gpt-5-mini' }
      const answer = await call('update_bot', { profile: 'default', soul: '# New', model: next })
      expect(answer.ok).toBe(false)
      expect(answer.text).toContain('analyst')
      expect(answer.text).toContain('soul')
      expect(engine.profiles.default.model).toEqual(next)
    })

    it('should report the refused field when the bots on "Uses default" cannot be reached either', async () => {
      engine.failSection('soul')
      let describes = 0
      // Talyx's model is read once before the save and once after it, to follow: the second fails.
      const run = mcpTools(
        backendFor({
          ...engine,
          request: async (profile, method, params) => {
            if (method === 'profiles.describe' && ++describes > 1)
              throw new Error('Gateway socket closed')
            return engine.request(profile, method, params)
          }
        }),
        async () => true
      )
      const next = { provider: 'openai', model: 'gpt-5-mini' }
      const answer = await run('update_bot', { profile: 'default', soul: '# New', model: next })
      expect(answer.ok).toBe(false)
      expect(answer.text).toContain('soul')
      expect(answer.text).not.toContain('Gateway socket closed')
    })

    it('should name the bots that stayed on the old model when Talyx gets a new one', async () => {
      engine.metadata.analyst[BOT_META_KEY] = { title: 'Analyst', usesDefault: true }
      engine.refuseModelOn.add('analyst')
      const next = { provider: 'openai', model: 'gpt-5-mini' }
      expect(await ok('update_bot', { profile: 'default', model: next })).toEqual({
        profile: 'default',
        stillOnOldModel: ['analyst']
      })
      expect(engine.profiles.default.model).toEqual(next)
    })
  })

  describe('set_reasoning', () => {
    it('should set the bot’s default reasoning', async () => {
      await ok('set_reasoning', { profile: 'analyst', level: 'high' })
      expect(engine.reasoning.analyst).toBe('high')
    })
  })

  describe('hide_bot', () => {
    it('should hide a shown bot', async () => {
      expect(await ok('hide_bot', { profile: 'analyst', hidden: true })).toEqual({
        profile: 'analyst',
        hidden: true
      })
      expect(metaOf('analyst').hidden).toBe(true)
    })

    it('should change nothing when the bot already matches the state asked for', async () => {
      await ok('hide_bot', { profile: 'analyst', hidden: true })
      engine.configureCalls.length = 0
      expect(await ok('hide_bot', { profile: 'analyst', hidden: true })).toEqual({
        profile: 'analyst',
        hidden: true
      })
      expect(engine.configureCalls).toEqual([])
    })

    it('should show a hidden bot again', async () => {
      await ok('hide_bot', { profile: 'analyst', hidden: true })
      expect(await ok('hide_bot', { profile: 'analyst', hidden: false })).toEqual({
        profile: 'analyst',
        hidden: false
      })
      expect(metaOf('analyst').hidden).toBeFalsy()
    })

    it('should never hide Talyx’s own bot', async () => {
      const answer = await call('hide_bot', { profile: 'default', hidden: true })
      expect(answer).toEqual({
        ok: false,
        text: 'Talyx’s own bot cannot be hidden or deleted.'
      })
      expect(engine.configureCalls).toEqual([])
    })

    it('should leave Talyx’s own bot shown when asked to show it', async () => {
      expect(await ok('hide_bot', { profile: 'default', hidden: false })).toEqual({
        profile: 'default',
        hidden: false
      })
      expect(engine.configureCalls).toEqual([])
    })

    it('should refuse a bot that does not exist', async () => {
      const answer = await call('hide_bot', { profile: 'ghost', hidden: true })
      expect(answer.ok).toBe(false)
      expect(answer.text).toContain('ghost')
    })
  })

  describe('read_usage', () => {
    const usageReport = {
      total: { tokens: 12, requests: 3 },
      providers: [{ id: 'p1', name: 'Custom', usage: { tokens: 12, requests: 3 } }],
      models: [
        {
          model: 'm',
          providerId: 'p1',
          provider: 'Custom',
          tokens: 12,
          requests: 3
        }
      ],
      unread: ['gone'],
      days: null,
      daysProblem: new Error('days'),
      daysUnread: ['quiet']
    }

    beforeEach(() => {
      engine.usage = async () => usageReport
    })

    it('should return only days, total, providers, models and unread', async () => {
      const result = await ok('read_usage', { days: 7 })
      expect(result).toEqual({
        days: 7,
        total: usageReport.total,
        providers: usageReport.providers,
        models: usageReport.models,
        unread: usageReport.unread
      })
      expect(Object.keys(result)).toEqual(['days', 'total', 'providers', 'models', 'unread'])
    })

    it('should say why when usage cannot be read', async () => {
      engine.usage = async () => {
        throw new Error('The usage store is locked')
      }
      const answer = await call('read_usage', { days: 7 })
      expect(answer.ok).toBe(false)
      expect(answer.text).toContain('The usage store is locked')
    })

    it('should reject days of 0 as invalid arguments', async () => {
      const answer = await call('read_usage', { days: 0 })
      expect(answer.ok).toBe(false)
      expect(answer.text).toMatch(/^Invalid arguments/)
    })

    it('should reject days of 91 as invalid arguments', async () => {
      const answer = await call('read_usage', { days: 91 })
      expect(answer.ok).toBe(false)
      expect(answer.text).toMatch(/^Invalid arguments/)
    })

    it('should reject a non-integer days value as invalid arguments', async () => {
      const answer = await call('read_usage', { days: 2.5 })
      expect(answer.ok).toBe(false)
      expect(answer.text).toMatch(/^Invalid arguments/)
    })
  })

  describe('delete_bot', () => {
    it('should delete the bot once the user allows it', async () => {
      expect(await ok('delete_bot', { profile: 'analyst' })).toEqual({ deleted: 'analyst' })
      expect(asked[0]).toMatchObject({
        tool: 'delete_bot',
        action: 'Delete the bot “Analyst” and everything it keeps. This cannot be undone.'
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
      expect(roster().folders).toEqual([{ id: 'team', name: 'Crew', parentId: null }])
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
      expect(roster().folders).toEqual([{ id: 'team', name: 'Team', parentId: null }])
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

    it('should pin a bot in front of another pinned bot', async () => {
      await ok('create_bot', { name: 'Scout' })
      await ok('pin_item', { kind: 'bot', id: 'analyst', pinned: true })
      await ok('pin_item', { kind: 'bot', id: 'scout', pinned: true, beforeBot: 'analyst' })
      expect(metaOf('scout')).toMatchObject({ pinned: true, pinnedOrder: 0 })
      expect(metaOf('analyst')).toMatchObject({ pinned: true, pinnedOrder: 1 })
    })

    it('should move a pinned bot down in front of the bot named', async () => {
      await ok('create_bot', { name: 'Scout' })
      for (const id of ['analyst', 'scout', 'default'])
        await ok('pin_item', { kind: 'bot', id, pinned: true })
      await ok('pin_item', { kind: 'bot', id: 'analyst', pinned: true, beforeBot: 'default' })
      expect(pinnedBots(roster().bots).map((bot) => bot.name)).toEqual([
        'scout',
        'analyst',
        'default'
      ])
    })

    it('should refuse to go in front of a bot that is not pinned', async () => {
      const answer = await call('pin_item', {
        kind: 'bot',
        id: 'analyst',
        pinned: true,
        beforeBot: 'default'
      })
      expect(answer).toEqual({
        ok: false,
        text: 'Nothing can go in front of a bot that is not pinned: default'
      })
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

  describe('send_bot_message', () => {
    it('should post a message in a bot chat as the user', async () => {
      expect(await ok('send_bot_message', { profile: 'analyst', text: ' Plan the week ' })).toEqual(
        {
          profile: 'analyst',
          sent: true
        }
      )
      expect(engine.botSends).toEqual([{ profile: 'analyst', text: 'Plan the week' }])
    })

    it('should refuse a bot that does not exist, sending nothing', async () => {
      const answer = await call('send_bot_message', { profile: 'ghost', text: 'Hi' })
      expect(answer).toEqual({
        ok: false,
        text: 'That bot no longer exists. Refresh the roster. ghost'
      })
      expect(engine.botSends).toEqual([])
    })

    it('should refuse blank text without sending', async () => {
      const answer = await call('send_bot_message', { profile: 'analyst', text: '  ' })
      expect(answer.ok).toBe(false)
      expect(answer.text).toMatch(/^Invalid arguments/)
      expect(engine.botSends).toEqual([])
    })

    it('should refuse text that is too long', async () => {
      const answer = await call('send_bot_message', {
        profile: 'analyst',
        text: 'x'.repeat(MCP_TEXT_MAX + 1)
      })
      expect(answer.ok).toBe(false)
      expect(answer.text).toMatch(/^Invalid arguments/)
      expect(engine.botSends).toEqual([])
    })

    it('should pass on the real reason when the send fails', async () => {
      engine.failBotSend = 'The engine is busy'
      const answer = await call('send_bot_message', { profile: 'analyst', text: 'Hi' })
      expect(answer.ok).toBe(false)
      expect(answer.text).toContain('The engine is busy')
      expect(engine.botSends).toEqual([])
    })
  })

  describe('read_bot_replies', () => {
    it('should read the newest replies, oldest first, with the default limit', async () => {
      engine.botRepliesByProfile.analyst = Array.from(
        { length: 60 },
        (_, index) => `Reply ${index + 1}`
      )
      expect(await ok('read_bot_replies', { profile: 'analyst' })).toEqual({
        replies: Array.from({ length: 50 }, (_, index) => `Reply ${index + 11}`)
      })
    })

    it('should read only as many replies as the limit names', async () => {
      engine.botRepliesByProfile.analyst = ['One', 'Two', 'Three', 'Four']
      expect(await ok('read_bot_replies', { profile: 'analyst', limit: 2 })).toEqual({
        replies: ['Three', 'Four']
      })
    })

    it('should refuse a bot that does not exist', async () => {
      const answer = await call('read_bot_replies', { profile: 'ghost' })
      expect(answer).toEqual({
        ok: false,
        text: 'That bot no longer exists. Refresh the roster. ghost'
      })
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

    it('should change who is in a room, keeping the room', async () => {
      expect(
        await ok('set_room_members', { roomId: 'room', members: ['default', 'analyst'] })
      ).toEqual({ roomId: 'room', members: ['default', 'analyst'] })
      expect(roster().rooms[0]).toMatchObject({ room_id: 'room', name: 'Team room' })
      expect(roster().rooms[0].members.map((member) => member.profile)).toEqual([
        'default',
        'analyst'
      ])
    })

    it('should refuse a bot that does not exist, changing nothing', async () => {
      const answer = await call('set_room_members', {
        roomId: 'room',
        members: ['analyst', 'ghost']
      })
      expect(answer.ok).toBe(false)
      expect(engine.rooms[0].members).toEqual([{ profile: 'analyst' }])
    })

    it('should rename a room', async () => {
      expect(await ok('rename_room', { roomId: 'room', name: 'Desk' })).toEqual({
        roomId: 'room',
        name: 'Desk'
      })
      expect(roster().rooms[0].name).toBe('Desk')
    })

    it('should post a message in a room as the user', async () => {
      expect(await ok('send_room_message', { roomId: 'room', text: ' Plan the week ' })).toEqual({
        roomId: 'room',
        sent: true
      })
      expect(engine.roomLogs.room[0]).toMatchObject({
        kind: 'message.user',
        payload: { text: 'Plan the week', attachments: [] }
      })
    })

    it('should refuse to post in a room that does not exist', async () => {
      const answer = await call('send_room_message', { roomId: 'gone', text: 'Hi' })
      expect(answer).toEqual({ ok: false, text: 'That room no longer exists. gone' })
    })

    it('should read the latest messages, oldest first, with who wrote each', async () => {
      engine.rooms[0].members = [
        { profile: 'analyst', member_id: 'analyst', display_name: 'Analyst' }
      ]
      await ok('send_room_message', { roomId: 'room', text: 'First' })
      engine.roomLogs.room.push(
        {
          seq: 2,
          event_id: 'e2',
          kind: 'room.activity',
          actor: { kind: 'system', id: 'driver' },
          payload: { status: 'running' },
          created_at: 2
        },
        {
          seq: 3,
          event_id: 'e3',
          kind: 'message.member',
          actor: { kind: 'member', id: 'analyst' },
          payload: { text: 'On it' },
          created_at: 3
        }
      )
      await ok('send_room_message', { roomId: 'room', text: 'Thanks' })
      expect(await ok('read_room_history', { roomId: 'room', limit: 2 })).toEqual({
        messages: [
          { seq: 3, from: 'Analyst', text: 'On it', at: 3 },
          { seq: 4, from: 'user', text: 'Thanks', at: expect.any(Number) }
        ],
        more: true
      })
    })

    it('should delete a room once the user allows it', async () => {
      await ok('pin_item', { kind: 'room', id: 'room', pinned: true })
      await ok('delete_room', { roomId: 'room' })
      expect(asked[0].action).toBe(
        'Delete the room “Team room” and its history. Its bots and their own chats stay.'
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

    it('should ask before adding a routine, and add none when the user says no', async () => {
      allow = false
      const answer = await call('add_routine', {
        profile: 'analyst',
        name: 'Cash',
        instruction: 'Check cash',
        schedule: { kind: 'daily', time: '08:30' }
      })
      expect(answer).toEqual({ ok: false, text: REFUSED })
      expect(asked[0].action).toBe(
        'Give “Analyst” the routine “Cash”. It runs on its own schedule, also while Talyx is closed. Its instruction: “Check cash”'
      )
      expect(engine.jobs.analyst ?? []).toEqual([])
    })

    it('should pause a routine without asking, and ask before resuming it', async () => {
      await addCash()
      asked = []
      await ok('set_routine_active', { profile: 'analyst', routineId: 'job-1', active: false })
      expect(engine.jobs.analyst[0].state).toBe('paused')
      expect(asked).toEqual([])
      allow = false
      expect(
        await call('set_routine_active', { profile: 'analyst', routineId: 'job-1', active: true })
      ).toEqual({ ok: false, text: REFUSED })
      expect(engine.jobs.analyst[0].state).toBe('paused')
    })

    it('should delete a routine once the user allows it', async () => {
      await addCash()
      await ok('delete_routine', { profile: 'analyst', routineId: 'job-1' })
      expect(asked.at(-1)?.action).toBe('Delete the routine “Cash”. This cannot be undone.')
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

  describe('memories', () => {
    it('should list nothing for a bot that remembers nothing', async () => {
      expect(await ok('list_memories', { profile: 'default' })).toEqual({
        memories: [],
        otherStore: null
      })
    })

    it('should list what a bot remembers about its work and about the user', async () => {
      const list = await ok('list_memories', { profile: 'analyst' })
      expect(
        (list.memories as { text: string; about: string }[]).map(({ text, about }) => ({
          text,
          about
        }))
      ).toEqual([
        { text: 'Reports go out on Mondays.', about: 'bot' },
        { text: 'The user prefers euros.', about: 'user' }
      ])
      expect(list.otherStore).toBeNull()
    })

    it('should refuse a bot that does not exist', async () => {
      const answer = await call('list_memories', { profile: 'ghost' })
      expect(answer).toEqual({
        ok: false,
        text: 'That bot no longer exists. Refresh the roster. ghost'
      })
    })

    it('should change a memory once the user allows it and return the list again', async () => {
      const listed = await ok('list_memories', { profile: 'analyst' })
      const [first] = listed.memories as { id: string; text: string }[]
      const updated = await ok('edit_memory', {
        profile: 'analyst',
        id: first.id,
        text: 'Reports go out on Fridays.'
      })
      expect(asked[0].action).toBe(
        'Change a memory of “Analyst”. The old text is lost. Old text: “Reports go out on Mondays.” New text: “Reports go out on Fridays.”'
      )
      expect((updated.memories as { text: string }[]).map((memory) => memory.text)).toEqual([
        'Reports go out on Fridays.',
        'The user prefers euros.'
      ])
    })

    it('should show a memory that holds a placeholder as it is written', async () => {
      engine.minds.bots.analyst.memories[0].text = 'Send {text} to {name}.'
      const [first] = (await ok('list_memories', { profile: 'analyst' })).memories as {
        id: string
      }[]
      await ok('edit_memory', { profile: 'analyst', id: first.id, text: 'Send nothing.' })
      expect(asked[0].action).toBe(
        'Change a memory of “Analyst”. The old text is lost. Old text: “Send {text} to {name}.” New text: “Send nothing.”'
      )
    })

    it('should refuse the change when the memory changed while the user was asked', async () => {
      const [first] = (await ok('list_memories', { profile: 'analyst' })).memories as {
        id: string
      }[]
      const run = mcpTools(backendFor(engine), async () => {
        engine.minds.bots.analyst.memories[0].text = 'Reports go out on Tuesdays.'
        return true
      })
      const answer = await run('edit_memory', { profile: 'analyst', id: first.id, text: 'Gone' })
      expect(answer).toEqual({
        ok: false,
        text: 'The bot changed this memory since the list was loaded. The list shows it as it is now.'
      })
      expect(engine.minds.bots.analyst.memories[0].text).toBe('Reports go out on Tuesdays.')
    })

    it('should keep the memory when the user says no', async () => {
      const [first] = (await ok('list_memories', { profile: 'analyst' })).memories as {
        id: string
        text: string
      }[]
      allow = false
      expect(await call('edit_memory', { profile: 'analyst', id: first.id, text: 'Gone' })).toEqual(
        { ok: false, text: REFUSED }
      )
      expect(engine.minds.bots.analyst.memories[0].text).toBe('Reports go out on Mondays.')
    })

    it('should refuse empty text without asking', async () => {
      const [first] = (await ok('list_memories', { profile: 'analyst' })).memories as {
        id: string
      }[]
      const answer = await call('edit_memory', { profile: 'analyst', id: first.id, text: '  ' })
      expect(answer.ok).toBe(false)
      expect(answer.text).toMatch(/^Invalid arguments/)
      expect(asked).toEqual([])
    })

    it('should refuse a memory id that does not exist', async () => {
      const answer = await call('edit_memory', {
        profile: 'analyst',
        id: 'gone',
        text: 'Something'
      })
      expect(answer).toEqual({ ok: false, text: 'That memory no longer exists. gone' })
    })

    it('should delete a memory once the user allows it and return the list again', async () => {
      const [first] = (await ok('list_memories', { profile: 'analyst' })).memories as {
        id: string
        text: string
      }[]
      const updated = await ok('delete_memory', { profile: 'analyst', id: first.id })
      expect(asked.at(-1)?.action).toBe(
        'Delete a memory of “Analyst”. This cannot be undone. The memory: “Reports go out on Mondays.”'
      )
      expect((updated.memories as { text: string }[]).map((memory) => memory.text)).toEqual([
        'The user prefers euros.'
      ])
    })

    it('should keep the memory when the user says no to a delete', async () => {
      const [first] = (await ok('list_memories', { profile: 'analyst' })).memories as {
        id: string
      }[]
      allow = false
      expect(await call('delete_memory', { profile: 'analyst', id: first.id })).toEqual({
        ok: false,
        text: REFUSED
      })
      expect(engine.minds.bots.analyst.memories).toHaveLength(2)
    })
  })

  describe('skills', () => {
    it('should list nothing for a bot with no skills', async () => {
      engine.minds.bots.default.skills = []
      expect(await ok('list_skills', { profile: 'default' })).toEqual({ skills: [] })
    })

    it('should list every skill by name, the ones turned off included', async () => {
      expect(await ok('list_skills', { profile: 'analyst' })).toEqual({
        skills: [
          {
            name: 'cash-report',
            description: 'Weekly cash position',
            enabled: false,
            removable: true
          },
          { name: 'web-search', description: 'Search the web', enabled: true, removable: false }
        ]
      })
    })

    it('should read a skill as its instructions file', async () => {
      expect(await ok('read_skill', { profile: 'analyst', name: 'cash-report' })).toEqual({
        name: 'cash-report',
        text: '# Cash report'
      })
    })

    it('should turn a skill on or off without asking', async () => {
      await ok('set_skill_enabled', { profile: 'analyst', name: 'cash-report', enabled: true })
      expect(
        engine.minds.bots.analyst.skills.find((skill) => skill.name === 'cash-report')?.enabled
      ).toBe(true)
      expect(asked).toEqual([])
    })

    it('should replace instructions once the user allows it', async () => {
      await ok('edit_skill', { profile: 'analyst', name: 'cash-report', text: '# Cash, weekly' })
      expect(asked[0].action).toBe(
        'Replace the instructions of the skill “cash-report” of “Analyst”. The text it has now is lost.'
      )
      expect(
        engine.minds.bots.analyst.skills.find((skill) => skill.name === 'cash-report')?.text
      ).toBe('# Cash, weekly')
    })

    it('should keep instructions as they are written, blank lines included', async () => {
      await ok('edit_skill', { profile: 'analyst', name: 'cash-report', text: '\n# Cash\n' })
      expect(
        engine.minds.bots.analyst.skills.find((skill) => skill.name === 'cash-report')?.text
      ).toBe('\n# Cash\n')
    })

    it('should keep the skill when the user says no to an edit', async () => {
      allow = false
      expect(
        await call('edit_skill', { profile: 'analyst', name: 'cash-report', text: '# Gone' })
      ).toEqual({ ok: false, text: REFUSED })
      expect(
        engine.minds.bots.analyst.skills.find((skill) => skill.name === 'cash-report')?.text
      ).toBe('# Cash report')
    })

    it('should refuse empty instructions without asking', async () => {
      const answer = await call('edit_skill', {
        profile: 'analyst',
        name: 'cash-report',
        text: '  '
      })
      expect(answer.ok).toBe(false)
      expect(answer.text).toMatch(/^Invalid arguments/)
      expect(asked).toEqual([])
    })

    it('should refuse a skill name that does not exist', async () => {
      const answer = await call('read_skill', { profile: 'analyst', name: 'gone' })
      expect(answer).toEqual({ ok: false, text: 'That skill no longer exists. gone' })
    })

    it('should delete a skill the bot made once the user allows it', async () => {
      await ok('delete_skill', { profile: 'analyst', name: 'cash-report' })
      expect(asked.at(-1)?.action).toBe(
        'Delete the skill “cash-report” of “Analyst”. This cannot be undone.'
      )
      expect(
        (await ok('list_skills', { profile: 'analyst' })).skills as { name: string }[]
      ).toEqual([
        { name: 'web-search', description: 'Search the web', enabled: true, removable: false }
      ])
    })

    it('should refuse to delete a built-in skill without asking', async () => {
      const answer = await call('delete_skill', { profile: 'analyst', name: 'web-search' })
      expect(answer).toEqual({
        ok: false,
        text: 'Only skills the bot made can be deleted. Turn this one off instead.'
      })
      expect(asked).toEqual([])
    })

    it('should keep the skill when the user says no to a delete', async () => {
      allow = false
      expect(await call('delete_skill', { profile: 'analyst', name: 'cash-report' })).toEqual({
        ok: false,
        text: REFUSED
      })
      expect(engine.minds.bots.analyst.skills.map((skill) => skill.name)).toContain('cash-report')
    })

    it('should refuse a bot that does not exist', async () => {
      const answer = await call('list_skills', { profile: 'ghost' })
      expect(answer).toEqual({
        ok: false,
        text: 'That bot no longer exists. Refresh the roster. ghost'
      })
    })
  })
})
