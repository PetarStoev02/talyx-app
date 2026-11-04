import { beforeEach, describe, expect, it } from 'vitest'
import { refreshRoster } from '../../../src/renderer/src/features/bots/actions'
import type { RosterBackend } from '../../../src/renderer/src/features/bots/data'
import {
  UnfiledBotError,
  createBot,
  profileIdFor
} from '../../../src/renderer/src/features/bots/create'
import type { NewBot } from '../../../src/renderer/src/features/bots/create'
import { RosterError, folderBots } from '../../../src/renderer/src/features/bots/roster'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import { BOT_META_KEY, backendFor, engineDouble } from './engineDouble'
import type { EngineDouble } from './engineDouble'

const TEAM = { id: 'team', name: 'Team' }
const SOUL = [
  '# Agro Ops Legal',
  '',
  'You are Agro Ops Legal, a persistent named agent (profile `agro-ops-legal`) on this machine.',
  'You keep your own memory, skills, and conversation history across sessions.'
].join('\n')

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
    it('should create the profile with its own SOUL and model', async () => {
      expect(await createBot(backend, newBot(), ['default', 'analyst'])).toBe('agro-ops-legal')
      expect(engine.created).toEqual([
        { name: 'agro-ops-legal', soul: SOUL, model: 'paid-model', provider: 'custom' }
      ])
    })

    it('should leave the model to the engine when none is picked', async () => {
      await createBot(backend, newBot({ model: null }), [])
      expect(engine.created[0]).not.toHaveProperty('model')
      expect(engine.created[0]).not.toHaveProperty('provider')
    })

    it('should place the new bot in its folder with its title and no avatar', async () => {
      await createBot(backend, newBot(), [])
      expect(engine.metadata['agro-ops-legal'][BOT_META_KEY]).toEqual({
        title: 'Agro Ops Legal',
        sectionId: 'team',
        sectionName: 'Team'
      })
      await refreshRoster(backend)
      const team = folderBots(useRoster.getState().snapshot, 'team').map((bot) => bot.name)
      expect(team).toContain('agro-ops-legal')
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
      await expect(creating).rejects.toBeInstanceOf(UnfiledBotError)
      await expect(creating).rejects.toMatchObject({
        profile: 'bot-1',
        key: 'create.errorNotFiled',
        detail: 'Socket closed'
      })
      expect(engine.created).toHaveLength(1)
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
