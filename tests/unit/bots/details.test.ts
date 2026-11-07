import { beforeEach, describe, expect, it } from 'vitest'
import { refreshRoster } from '../../../src/renderer/src/features/bots/actions'
import type { RosterBackend } from '../../../src/renderer/src/features/bots/data'
import {
  SectionsNotSavedError,
  confirmModel,
  loadDetails,
  refusedSectionProblem,
  saveDetails,
  setBotModel,
  useDetailsRevision
} from '../../../src/renderer/src/features/bots/details'
import type { DetailsDraft } from '../../../src/renderer/src/features/bots/details'
import { lookOf } from '../../../src/renderer/src/features/bots/look'
import { RosterError } from '../../../src/renderer/src/features/bots/roster'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import type { Bot } from '../../../src/renderer/src/features/bots/types'
import {
  BOT_META_KEY,
  HOME_ENDPOINT,
  HOME_KEY_REF,
  backendFor,
  engineDouble,
  namedEndpoint,
  pngOf
} from './engineDouble'
import type { EngineDouble } from './engineDouble'

let engine: EngineDouble
let backend: RosterBackend

beforeEach(async () => {
  engine = engineDouble({
    default: {},
    analyst: { [BOT_META_KEY]: { title: 'Analyst', sectionId: 'team', sectionName: 'Team' } },
    blank: {}
  })
  backend = backendFor(engine)
  await refreshRoster(backend)
})

const bot = (name: string): Bot => useRoster.getState().snapshot.bots.find((b) => b.name === name)!

async function opening(name: string): Promise<DetailsDraft> {
  return {
    title: bot(name).meta.title ?? '',
    look: lookOf(bot(name)),
    ...(await loadDetails(backend, name))
  }
}

describe('bot details', () => {
  describe('loadDetails', () => {
    it('should load description, SOUL and model from the engine', async () => {
      expect(await loadDetails(backend, 'analyst')).toEqual({
        description: 'Numbers',
        soul: '# Analyst',
        model: { provider: 'custom', model: '9-route-provider' }
      })
    })

    it('should return no model when the profile has no pin', async () => {
      expect((await loadDetails(backend, 'blank')).model).toBeNull()
    })
  })

  describe('saveDetails', () => {
    it('should write nothing when nothing changed', async () => {
      const draft = await opening('analyst')
      expect(await saveDetails(backend, bot('analyst'), { opening: draft, draft })).toBeNull()
      expect(engine.configureCalls).toEqual([])
      expect(engine.configured).toEqual([])
      expect(engine.assets).toEqual([])
    })

    it('should send only the changed sections', async () => {
      const before = await opening('analyst')
      await saveDetails(backend, bot('analyst'), {
        opening: before,
        draft: { ...before, soul: '# New' }
      })
      expect(engine.configured).toEqual([{ name: 'analyst', soul: '# New' }])
      expect(engine.configureCalls).toEqual([])
    })

    it('should tell the views showing details to read them again after a save', async () => {
      const before = await opening('analyst')
      const revision = useDetailsRevision.getState().revision
      await saveDetails(backend, bot('analyst'), {
        opening: before,
        draft: { ...before, description: 'Forecasts' }
      })
      expect(useDetailsRevision.getState().revision).toBe(revision + 1)
    })

    it('should save the title in the bot metadata', async () => {
      const before = await opening('analyst')
      await saveDetails(backend, bot('analyst'), {
        opening: before,
        draft: { ...before, title: 'Lead analyst' }
      })
      expect(engine.metadata.analyst[BOT_META_KEY]).toEqual({
        title: 'Lead analyst',
        sectionId: 'team',
        sectionName: 'Team'
      })
      expect(engine.configured).toEqual([])
    })

    it('should save a new look in the bot metadata and export it as the avatar image', async () => {
      const before = await opening('analyst')
      const look = { shape: 'tower' as const, hue: 2, faces: false }
      await saveDetails(backend, bot('analyst'), { opening: before, draft: { ...before, look } })
      expect(engine.metadata.analyst[BOT_META_KEY]).toEqual({
        title: 'Analyst',
        sectionId: 'team',
        sectionName: 'Team',
        shape: 'tower',
        color: 2,
        faces: false
      })
      expect(engine.assets).toEqual([
        { profile: 'analyst', params: { name: 'analyst', asset: 'avatar', data: pngOf(look) } }
      ])
      await refreshRoster(backend)
      expect(lookOf(bot('analyst'))).toEqual(look)
    })

    it("should turn Talyx's face off without exporting an image", async () => {
      const before = await opening('default')
      await saveDetails(backend, bot('default'), {
        opening: before,
        draft: { ...before, look: { ...before.look, faces: false } }
      })
      expect(engine.metadata.default[BOT_META_KEY]).toEqual({ faces: false })
      expect(engine.assets).toEqual([])
    })

    it('should save nothing when the image export fails, so the same Save can retry', async () => {
      engine.failAssetOnce()
      const before = await opening('analyst')
      const look = { shape: 'slab' as const, hue: 8, faces: true }
      const change = { opening: before, draft: { ...before, look, soul: '# New' } }
      await expect(saveDetails(backend, bot('analyst'), change)).rejects.toThrow(
        'Asset store is read-only'
      )
      expect(engine.metadata.analyst[BOT_META_KEY]).not.toHaveProperty('shape')
      expect(engine.configured).toEqual([])
      await saveDetails(backend, bot('analyst'), change)
      expect(engine.metadata.analyst[BOT_META_KEY]).toMatchObject({ shape: 'slab', color: 8 })
      expect(engine.assets.map((asset) => asset.params.data)).toEqual([pngOf(look)])
    })

    it('should drop a stale metadata description when the description changes', async () => {
      engine.metadata.analyst[BOT_META_KEY] = { title: 'Analyst', description: 'old' }
      await refreshRoster(backend)
      const before = await opening('analyst')
      await saveDetails(backend, bot('analyst'), {
        opening: before,
        draft: { ...before, description: '  Margins and cash  ' }
      })
      expect(
        (engine.metadata.analyst[BOT_META_KEY] as Record<string, unknown>).description
      ).toBeUndefined()
      expect(engine.profiles.analyst.description).toBe('Margins and cash')
    })

    it('should ask before an expensive model and keep the other sections and the look', async () => {
      engine.expensiveModels.add('big')
      const before = await opening('analyst')
      const look = { ...before.look, hue: 0 }
      const confirm = await saveDetails(backend, bot('analyst'), {
        opening: before,
        draft: { ...before, look, soul: '# Bigger', model: { provider: 'custom', model: 'big' } }
      })
      expect(engine.assets.map((asset) => asset.params.data)).toEqual([pngOf(look)])
      expect(confirm).toEqual({
        message: 'Costs more',
        model: { provider: 'custom', model: 'big' }
      })
      expect(engine.profiles.analyst.soul).toBe('# Bigger')
      expect(engine.profiles.analyst.model).toEqual({
        provider: 'custom',
        model: '9-route-provider'
      })
    })

    it('should send a plain model change without asking', async () => {
      const before = await opening('analyst')
      const confirm = await saveDetails(backend, bot('analyst'), {
        opening: before,
        draft: { ...before, model: { provider: 'custom', model: 'paid-model' } }
      })
      expect(confirm).toBeNull()
      expect(engine.configured).toEqual([])
      expect(engine.profiles.analyst.model).toEqual({ provider: 'custom', model: 'paid-model' })
    })

    it('should switch a custom bot to a built-in provider and back', async () => {
      const haiku = { provider: 'anthropic', model: 'claude-haiku-4-5' }
      const custom = { provider: 'custom', model: '9-route-provider' }
      for (const model of [haiku, custom]) {
        const before = await opening('analyst')
        expect(
          await saveDetails(backend, bot('analyst'), {
            opening: before,
            draft: { ...before, model }
          })
        ).toBeNull()
        expect((await loadDetails(backend, 'analyst')).model).toEqual(model)
      }
    })

    it('should name the sections the engine did not apply', async () => {
      engine.failSection('soul')
      const before = await opening('analyst')
      const saving = saveDetails(backend, bot('analyst'), {
        opening: before,
        draft: { ...before, soul: '# New', description: 'New' }
      })
      await expect(saving).rejects.toBeInstanceOf(RosterError)
      await expect(saving).rejects.toMatchObject({
        key: 'details.errorNotApplied',
        detail: 'soul',
        sections: ['soul']
      })
      expect(engine.profiles.analyst.description).toBe('New')
    })

    it('should list every section the engine refused', async () => {
      engine.failSection('soul')
      engine.failSection('model')
      const before = await opening('analyst')
      const saving = saveDetails(backend, bot('analyst'), {
        opening: before,
        draft: { ...before, soul: '# New', model: { provider: 'custom', model: 'other' } }
      })
      await expect(saving).rejects.toBeInstanceOf(SectionsNotSavedError)
      await expect(saving).rejects.toMatchObject({
        sections: ['soul', 'model'],
        reason: 'Engine HTTP 400: model switch rejected'
      })
    })
  })

  describe('refusedSectionProblem', () => {
    it.each([
      ['model', { key: 'details.errorModel', detail: null }],
      ['description', { key: 'details.errorDescription', detail: null }],
      ['soul', { key: 'details.errorSoul', detail: null }],
      ['provider', { key: 'details.errorNotApplied', detail: 'provider' }]
    ])('should give a refused %s its message', (section, problem) => {
      expect(refusedSectionProblem(section)).toEqual(problem)
    })

    it('should show what the engine said under a refused model', () => {
      expect(refusedSectionProblem('model', 'Restart required')).toEqual({
        key: 'details.errorModel',
        detail: 'Restart required'
      })
    })
  })

  describe('confirmModel', () => {
    it('should apply a confirmed model', async () => {
      engine.expensiveModels.add('big')
      await confirmModel(backend, 'analyst', { provider: 'custom', model: 'big' })
      expect(engine.modelSets.at(-1)).toEqual({
        profile: 'analyst',
        scope: 'main',
        provider: 'custom',
        model: 'big',
        base_url: HOME_ENDPOINT,
        api_key: HOME_KEY_REF,
        confirm_expensive_model: true
      })
      expect((await loadDetails(backend, 'analyst')).model).toEqual({
        provider: 'custom',
        model: 'big'
      })
    })
  })

  describe('setBotModel', () => {
    const custom = { provider: 'custom', model: '9-route-provider' }
    const haiku = { provider: 'anthropic', model: 'claude-haiku-4-5' }

    beforeEach(() => {
      engine.profiles.analyst.model = haiku
    })

    it("should send Talyx's endpoint URL and key variable with a bare custom model", async () => {
      expect(await setBotModel(backend, 'analyst', custom)).toBeNull()
      expect(engine.modelSets).toEqual([
        {
          profile: 'analyst',
          scope: 'main',
          ...custom,
          base_url: HOME_ENDPOINT,
          api_key: HOME_KEY_REF
        }
      ])
      expect(engine.profiles.analyst.model).toEqual(custom)
    })

    it('should never send a key written into the config, only its variable', async () => {
      engine.homeKeyPreview = 'sk-...abcd'
      await setBotModel(backend, 'analyst', custom)
      expect(engine.modelSets).toEqual([
        { profile: 'analyst', scope: 'main', ...custom, base_url: HOME_ENDPOINT }
      ])
    })

    it("should give a bot Talyx's named endpoint and switch it there and back", async () => {
      const kept = { provider: 'endpoint-127-0-0-1-20128', model: '9-route-provider' }
      engine.homeProvider = 'anthropic'
      engine.named.default = [
        namedEndpoint(kept.provider, {
          name: 'Custom endpoint (127.0.0.1:20128)',
          base_url: HOME_ENDPOINT,
          model: kept.model,
          models: { [kept.model]: {} },
          discover_models: true,
          key_env: 'ROUTER_API_KEY'
        })
      ]
      for (const model of [kept, haiku, kept]) {
        await setBotModel(backend, 'analyst', model)
        expect(engine.profiles.analyst.model).toEqual(model)
      }
      expect(engine.named.analyst).toEqual(engine.named.default)
      expect(engine.named.analyst[0].api_key_preview).toBe('${ROUTER_API_KEY}')
    })

    it("should keep Talyx's custom endpoint when its own model leaves it from its details", async () => {
      await setBotModel(backend, 'default', haiku)
      expect(engine.named.default.map((item) => [item.id, item.api_key_preview])).toEqual([
        ['endpoint-127-0-0-1-20128', HOME_KEY_REF]
      ])
      expect(engine.profiles.default.model).toEqual(haiku)
    })

    it("should not write the key variable into Talyx's own model when it changes custom models", async () => {
      const other = { provider: 'custom', model: 'other-router-model' }
      engine.profiles.default.model = custom
      await setBotModel(backend, 'default', other)
      expect(engine.modelSets).toEqual([
        { profile: 'default', scope: 'main', ...other, base_url: HOME_ENDPOINT }
      ])
    })

    it("should not name Talyx's endpoint twice when a named one has its URL", async () => {
      engine.named.default = [
        namedEndpoint('my-router', {
          name: 'My router',
          base_url: HOME_ENDPOINT,
          model: '9-route-provider',
          models: { '9-route-provider': {} },
          discover_models: true,
          key_env: 'ROUTER_API_KEY'
        })
      ]
      await setBotModel(backend, 'default', haiku)
      expect(engine.named.default.map((item) => item.id)).toEqual(['my-router'])
    })

    it('should send no endpoint URL with a built-in provider', async () => {
      engine.profiles.analyst.model = custom
      await setBotModel(backend, 'analyst', haiku)
      expect(engine.modelSets).toEqual([{ profile: 'analyst', scope: 'main', ...haiku }])
      expect(engine.profiles.analyst.model).toEqual(haiku)
    })

    it('should report the model as not saved when the engine refuses it', async () => {
      engine.homeProvider = 'anthropic'
      const setting = setBotModel(backend, 'analyst', custom)
      await expect(setting).rejects.toBeInstanceOf(SectionsNotSavedError)
      await expect(setting).rejects.toMatchObject({
        sections: ['model'],
        reason: 'Engine HTTP 400: custom provider needs a base_url'
      })
      expect(engine.profiles.analyst.model).toEqual(haiku)
    })

    it('should ask before a costly model and keep the one the bot has', async () => {
      engine.expensiveModels.add('big')
      const big = { provider: 'anthropic', model: 'big' }
      expect(await setBotModel(backend, 'analyst', big)).toEqual({
        message: 'Costs more',
        model: big
      })
      expect(engine.profiles.analyst.model).toEqual(haiku)
    })
  })
})
