import { beforeEach, describe, expect, it } from 'vitest'
import { refreshRoster } from '../../../src/renderer/src/features/bots/actions'
import type { RosterBackend } from '../../../src/renderer/src/features/bots/data'
import {
  IncompleteBotError,
  createBot,
  profileIdFor
} from '../../../src/renderer/src/features/bots/create'
import type { NewBot } from '../../../src/renderer/src/features/bots/create'
import { RosterError, folderBots } from '../../../src/renderer/src/features/bots/roster'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import { matchName } from '../../../src/renderer/src/features/bots/look'
import {
  BOT_META_KEY,
  HOME_ENDPOINT,
  HOME_KEY_REF,
  backendFor,
  engineDouble,
  pngOf
} from './engineDouble'
import type { EngineDouble } from './engineDouble'

const TEAM = { id: 'team', name: 'Team' }
const SOUL = [
  '# Agro Ops Legal',
  '',
  'You are Agro Ops Legal, a persistent named agent (profile `agro-ops-legal`) on this machine.',
  'You keep your own memory, skills, and conversation history across sessions.'
].join('\n')

const LOOK = { shape: 'stair' as const, hue: 4, faces: true }

let engine: EngineDouble
let backend: RosterBackend

beforeEach(() => {
  engine = engineDouble()
  backend = backendFor(engine)
})

const newBot = (patch: Partial<NewBot> = {}): NewBot => ({
  name: 'Agro Ops Legal',
  folder: TEAM,
  model: { provider: 'custom', model: 'paid-model' },
  look: LOOK,
  purpose: null,
  ...patch
})

describe('creating a bot', () => {
  describe('profileIdFor', () => {
    it.each([
      ['Agro Ops Legal', [], 'agro-ops-legal'],
      ['  Café  Bot!! ', [], 'cafe-bot'],
      ['Агро Юрист', [], 'bot-1'],
      ['Агро Юрист', ['bot-1'], 'bot-2'],
      ['a'.repeat(80), [], 'a'.repeat(64)]
    ])('should turn %j into a profile id', (name, taken, expected) => {
      expect(profileIdFor(name, taken)).toBe(expected)
    })

    it('should refuse a name that is already a bot', () => {
      expect(() => profileIdFor('Analyst', ['analyst'])).toThrow(RosterError)
      try {
        profileIdFor('Analyst', ['analyst'])
      } catch (error) {
        expect((error as RosterError).key).toBe('create.errorTaken')
      }
    })
  })

  describe('createBot', () => {
    it('should create the profile with its own SOUL', async () => {
      expect(await createBot(backend, newBot(), ['default', 'analyst'])).toBe('agro-ops-legal')
      expect(engine.created).toEqual([{ name: 'agro-ops-legal', soul: SOUL }])
    })

    it("should put a custom endpoint model on the new bot with Talyx's endpoint", async () => {
      await createBot(backend, newBot(), [])
      expect(engine.modelSets).toEqual([
        {
          profile: 'agro-ops-legal',
          scope: 'main',
          provider: 'custom',
          model: 'paid-model',
          base_url: HOME_ENDPOINT,
          api_key: HOME_KEY_REF,
          confirm_expensive_model: true
        }
      ])
      expect(engine.profiles['agro-ops-legal'].model).toEqual({
        provider: 'custom',
        model: 'paid-model'
      })
    })

    it('should put a built-in provider model on the new bot without an endpoint', async () => {
      const model = { provider: 'anthropic', model: 'claude-haiku-4-5' }
      await createBot(backend, newBot({ model }), [])
      expect(engine.modelSets).toEqual([
        { profile: 'agro-ops-legal', scope: 'main', ...model, confirm_expensive_model: true }
      ])
      expect(engine.profiles['agro-ops-legal'].model).toEqual(model)
    })

    it('should name the created profile when the engine refuses its model', async () => {
      engine.homeProvider = 'anthropic'
      const creating = createBot(backend, newBot(), [])
      await expect(creating).rejects.toBeInstanceOf(IncompleteBotError)
      await expect(creating).rejects.toMatchObject({
        profile: 'agro-ops-legal',
        key: 'create.errorModel'
      })
      expect(engine.profiles['agro-ops-legal'].model).toEqual({
        provider: 'custom',
        model: '9-route-provider'
      })
    })

    it('should write what the bot does into its SOUL', async () => {
      await createBot(backend, newBot({ purpose: 'Finds sources and sums them up' }), [])
      expect(engine.created[0].soul).toBe(`${SOUL}\n\nWhat you do: Finds sources and sums them up`)
    })

    it('should leave the SOUL alone when the purpose is blank', async () => {
      await createBot(backend, newBot({ purpose: '  ' }), [])
      expect(engine.created[0].soul).toBe(SOUL)
    })

    it('should leave the model to the engine when none is picked', async () => {
      await createBot(backend, newBot({ model: null }), [])
      expect(engine.modelSets).toEqual([])
    })

    it('should place the new bot in its folder with its title and look', async () => {
      await createBot(backend, newBot(), [])
      expect(engine.metadata['agro-ops-legal'][BOT_META_KEY]).toEqual({
        title: 'Agro Ops Legal',
        sectionId: 'team',
        sectionName: 'Team',
        shape: 'stair',
        color: 4
      })
      await refreshRoster(backend)
      const team = folderBots(useRoster.getState().snapshot, 'team').map((bot) => bot.name)
      expect(team).toContain('agro-ops-legal')
    })

    it("should export the look as the new profile's avatar image", async () => {
      const look = { ...matchName('agro-ops-legal'), faces: false }
      await createBot(backend, newBot({ look }), [])
      expect(engine.assets).toEqual([
        {
          profile: 'agro-ops-legal',
          params: { name: 'agro-ops-legal', asset: 'avatar', data: pngOf(look) }
        }
      ])
    })

    it('should name the created profile when the image export fails', async () => {
      engine.failAssetOnce()
      const creating = createBot(backend, newBot(), [])
      await expect(creating).rejects.toBeInstanceOf(IncompleteBotError)
      await expect(creating).rejects.toMatchObject({
        profile: 'agro-ops-legal',
        key: 'create.errorNoAvatar',
        detail: 'Asset store is read-only'
      })
      expect(engine.metadata['agro-ops-legal'][BOT_META_KEY]).toMatchObject({
        title: 'Agro Ops Legal'
      })
    })

    it('should leave an unfiled bot without a folder', async () => {
      await createBot(backend, newBot({ folder: null }), [])
      expect(engine.metadata['agro-ops-legal'][BOT_META_KEY]).toMatchObject({
        sectionId: null,
        sectionName: null
      })
    })

    it('should name the created profile when filing it fails, so a retry does not make another', async () => {
      engine.failMetaOnce()
      const creating = createBot(backend, newBot({ name: 'Агро Юрист' }), [])
      await expect(creating).rejects.toBeInstanceOf(IncompleteBotError)
      await expect(creating).rejects.toMatchObject({
        profile: 'bot-1',
        key: 'create.errorNotFiled',
        detail: 'Socket closed'
      })
      expect(engine.created).toHaveLength(1)
      expect(engine.assets).toEqual([])
    })

    it('should refuse a taken name without asking the engine', async () => {
      await expect(createBot(backend, newBot({ name: 'Analyst' }), ['analyst'])).rejects.toThrow(
        RosterError
      )
      expect(engine.created).toEqual([])
    })

    it("should surface the engine's refusal and write no metadata", async () => {
      await expect(createBot(backend, newBot({ name: 'reserved' }), [])).rejects.toThrow(
        'Profile name is reserved'
      )
      expect(engine.metadata.reserved).toBeUndefined()
    })
  })
})
