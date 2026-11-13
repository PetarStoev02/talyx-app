import { beforeEach, describe, expect, it } from 'vitest'
import { refreshRoster } from '../../../src/renderer/src/features/bots/actions'
import type { RosterBackend } from '../../../src/renderer/src/features/bots/data'
import {
  SectionsNotSavedError,
  confirmModel,
  followDefault,
  followIfDefaultChanged,
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
    usesDefault: bot(name).meta.usesDefault === true,
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

  describe('uses default', () => {
    const talyx = { provider: 'anthropic', model: 'claude-haiku-4-5' }

    beforeEach(() => {
      engine.profiles.default.model = talyx
    })

    it("should put a bot on Talyx's model and mark it as using the default", async () => {
      const before = await opening('analyst')
      expect(before.usesDefault).toBe(false)
      const confirm = await saveDetails(backend, bot('analyst'), {
        opening: before,
        draft: { ...before, usesDefault: true, model: talyx }
      })
      expect(confirm).toBeNull()
      expect(engine.profiles.analyst.model).toEqual(talyx)
      expect(engine.metadata.analyst[BOT_META_KEY]).toMatchObject({ usesDefault: true })
    })

    it("should pin a costly default without asking again: Talyx's model was already agreed", async () => {
      engine.expensiveModels.add(talyx.model)
      const before = await opening('analyst')
      const confirm = await saveDetails(backend, bot('analyst'), {
        opening: before,
        draft: { ...before, usesDefault: true, model: talyx }
      })
      expect(confirm).toBeNull()
      expect(engine.profiles.analyst.model).toEqual(talyx)
    })

    it('should stop following the default when the bot gets a model of its own', async () => {
      engine.metadata.analyst[BOT_META_KEY] = { title: 'Analyst', usesDefault: true }
      await refreshRoster(backend)
      const before = await opening('analyst')
      expect(before.usesDefault).toBe(true)
      await saveDetails(backend, bot('analyst'), {
        opening: before,
        draft: { ...before, usesDefault: false, model: { provider: 'custom', model: 'other' } }
      })
      expect(
        (engine.metadata.analyst[BOT_META_KEY] as Record<string, unknown>).usesDefault
      ).toBeUndefined()
      expect(engine.profiles.analyst.model).toEqual({ provider: 'custom', model: 'other' })
    })

    it('should keep a bot on the default when the user says no to a costly model of its own', async () => {
      engine.metadata.analyst[BOT_META_KEY] = { title: 'Analyst', usesDefault: true }
      engine.expensiveModels.add('big')
      await refreshRoster(backend)
      const before = await opening('analyst')
      const confirm = await saveDetails(backend, bot('analyst'), {
        opening: before,
        draft: { ...before, usesDefault: false, model: { provider: 'custom', model: 'big' } }
      })
      expect(confirm).not.toBeNull()
      expect(engine.metadata.analyst[BOT_META_KEY]).toMatchObject({ usesDefault: true })
    })

    it('should take a bot off the default once its own model is pinned, even when its SOUL was refused', async () => {
      engine.metadata.analyst[BOT_META_KEY] = { title: 'Analyst', usesDefault: true }
      engine.failSection('soul')
      await refreshRoster(backend)
      const before = await opening('analyst')
      const own = { provider: 'custom', model: 'own' }
      await expect(
        saveDetails(backend, bot('analyst'), {
          opening: before,
          draft: { ...before, soul: '# New', usesDefault: false, model: own }
        })
      ).rejects.toBeInstanceOf(SectionsNotSavedError)
      expect(engine.profiles.analyst.model).toEqual(own)
      expect(
        (engine.metadata.analyst[BOT_META_KEY] as Record<string, unknown>).usesDefault
      ).toBeUndefined()
    })

    it('should keep a bot on the default when its SOUL is refused and its costly model waits for a yes', async () => {
      engine.metadata.analyst[BOT_META_KEY] = { title: 'Analyst', usesDefault: true }
      engine.failSection('soul')
      engine.expensiveModels.add('big')
      await refreshRoster(backend)
      const before = await opening('analyst')
      await expect(
        saveDetails(backend, bot('analyst'), {
          opening: before,
          draft: {
            ...before,
            soul: '# New',
            usesDefault: false,
            model: { provider: 'custom', model: 'big' }
          }
        })
      ).rejects.toBeInstanceOf(SectionsNotSavedError)
      expect(engine.metadata.analyst[BOT_META_KEY]).toMatchObject({ usesDefault: true })
    })

    it('should take a bot off the default once its costly model of its own is confirmed', async () => {
      engine.metadata.analyst[BOT_META_KEY] = { title: 'Analyst', usesDefault: true }
      engine.expensiveModels.add('big')
      await confirmModel(backend, 'analyst', { provider: 'custom', model: 'big' })
      expect(
        (engine.metadata.analyst[BOT_META_KEY] as Record<string, unknown>).usesDefault
      ).toBeUndefined()
    })

    describe('followDefault', () => {
      const next = { provider: 'openai', model: 'gpt-5-mini' }

      beforeEach(() => {
        engine.metadata.analyst[BOT_META_KEY] = { title: 'Analyst', usesDefault: true }
        engine.metadata.helper = { [BOT_META_KEY]: { title: 'Helper', usesDefault: true } }
        engine.profiles.helper = { description: '', soul: '', model: talyx }
        engine.profiles.blank.model = { provider: 'custom', model: 'own' }
      })

      it("should move every bot on the default to Talyx's new model", async () => {
        expect(await followDefault(backend, next)).toEqual([])
        expect(engine.profiles.analyst.model).toEqual(next)
        expect(engine.profiles.helper.model).toEqual(next)
      })

      it('should leave a bot with its own model, as every bot made before this choice', async () => {
        await followDefault(backend, next)
        expect(engine.profiles.blank.model).toEqual({ provider: 'custom', model: 'own' })
        expect(engine.modelSets.map((set) => set.profile)).toEqual(['analyst', 'helper'])
      })

      it('should name the bots that did not take the new model and still move the others', async () => {
        engine.refuseModelOn.add('analyst')
        expect(await followDefault(backend, next)).toEqual(['analyst'])
        expect(engine.profiles.helper.model).toEqual(next)
      })

      it('should move bots onto a costly default without asking each one', async () => {
        engine.expensiveModels.add(next.model)
        expect(await followDefault(backend, next)).toEqual([])
        expect(engine.profiles.helper.model).toEqual(next)
      })

      it('should never move Talyx itself, even marked as using the default', async () => {
        engine.metadata.default[BOT_META_KEY] = { usesDefault: true }
        await followDefault(backend, next)
        expect(engine.profiles.default.model).toEqual(talyx)
      })

      it('should say the bots on the default were not reached when the bot list cannot be read', async () => {
        engine.failListOnce()
        await expect(followDefault(backend, next)).rejects.toMatchObject({
          key: 'details.errorFollowersUnreached'
        })
        expect(engine.modelSets).toEqual([])
      })

      it("should move the bots once Talyx's model changed, even when another section was refused", async () => {
        engine.failSection('soul')
        const before = await opening('default')
        await expect(
          saveDetails(backend, bot('default'), {
            opening: before,
            draft: { ...before, soul: '# New', model: next }
          })
        ).rejects.toBeInstanceOf(SectionsNotSavedError)
        expect(await followIfDefaultChanged(backend, before.model)).toEqual([])
        expect(engine.profiles.analyst.model).toEqual(next)
      })

      it("should move nothing when Talyx's model did not change", async () => {
        expect(await followIfDefaultChanged(backend, talyx)).toEqual([])
        expect(engine.modelSets).toEqual([])
      })

      it('should move nothing when no bot uses the default', async () => {
        delete engine.metadata.analyst[BOT_META_KEY]
        delete engine.metadata.helper[BOT_META_KEY]
        expect(await followDefault(backend, next)).toEqual([])
        expect(engine.modelSets).toEqual([])
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

  describe('saveDetails over Talyx operations', () => {
    const haiku = { provider: 'anthropic', model: 'claude-haiku' }
    const draft: DetailsDraft = {
      title: 'Analyst',
      look: lookOf({ name: 'analyst', meta: {} }),
      usesDefault: false,
      description: 'Numbers',
      soul: '# Analyst',
      model: { provider: 'custom', model: '9-route-provider' }
    }

    // The engine refuses both description and SOUL, and the model with its own words.
    function refusingBackend(): { backend: Parameters<typeof saveDetails>[0]; steps: string[] } {
      const steps: string[] = []
      const backend: Parameters<typeof saveDetails>[0] = {
        loadDetails: async () => ({ ...draft }),
        saveSections: async (_profile, sections) => {
          steps.push(`sections ${Object.keys(sections).join(',')}`)
          throw new SectionsNotSavedError(['description', 'soul'])
        },
        pinModel: async (_profile, pick) => {
          steps.push(`pin ${pick.model}`)
          throw new SectionsNotSavedError(['model'], 'No key for anthropic')
        },
        pinAgreedModel: async () => undefined,
        saveBotMeta: async () => undefined,
        setAvatar: async () => undefined
      }
      return { backend, steps }
    }

    it('should report every refused section together, with the model’s reason', async () => {
      const { backend, steps } = refusingBackend()

      const saving = saveDetails(
        backend,
        { name: 'analyst', meta: { title: 'Analyst' } },
        {
          opening: draft,
          draft: { ...draft, description: 'Cash', soul: '# Cash', model: haiku }
        }
      )

      await expect(saving).rejects.toMatchObject({
        sections: ['description', 'soul', 'model'],
        reason: 'No key for anthropic'
      })
      expect(steps).toEqual(['sections description,soul', 'pin claude-haiku'])
    })
  })
})
