import { beforeEach, describe, expect, it } from 'vitest'
import { refreshRoster } from '../../../src/renderer/src/features/bots/actions'
import type { RosterBackend } from '../../../src/renderer/src/features/bots/data'
import {
  confirmModel,
  loadDetails,
  saveDetails
} from '../../../src/renderer/src/features/bots/details'
import type { DetailsDraft } from '../../../src/renderer/src/features/bots/details'
import { RosterError } from '../../../src/renderer/src/features/bots/roster'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import type { Bot } from '../../../src/renderer/src/features/bots/types'
import { BOT_META_KEY, backendFor, engineDouble } from './engineDouble'
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
  return { title: bot(name).meta.title ?? '', ...(await loadDetails(backend, name)) }
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

    it('should ask before an expensive model and keep the other sections', async () => {
      engine.expensiveModels.add('big')
      const before = await opening('analyst')
      const confirm = await saveDetails(backend, bot('analyst'), {
        opening: before,
        draft: { ...before, soul: '# Bigger', model: { provider: 'custom', model: 'big' } }
      })
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

    it('should still ask when the engine reports the waiting model as not applied', async () => {
      engine.expensiveModels.add('big')
      const reportsModelFalse = backendFor({
        request: async (profile, method, params) => {
          const result = await engine.request(profile, method, params)
          const answer = result as { confirm_required?: boolean; applied?: object }
          return answer.confirm_required
            ? { ...answer, applied: { ...answer.applied, model: false } }
            : result
        }
      })
      const before = await opening('analyst')
      const confirm = await saveDetails(reportsModelFalse, bot('analyst'), {
        opening: before,
        draft: { ...before, model: { provider: 'custom', model: 'big' } }
      })
      expect(confirm?.model).toEqual({ provider: 'custom', model: 'big' })
    })

    it('should send a plain model change without asking', async () => {
      const before = await opening('analyst')
      const confirm = await saveDetails(backend, bot('analyst'), {
        opening: before,
        draft: { ...before, model: { provider: 'custom', model: 'paid-model' } }
      })
      expect(confirm).toBeNull()
      expect(engine.configured).toEqual([
        { name: 'analyst', model: 'paid-model', provider: 'custom' }
      ])
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
        detail: 'soul'
      })
      expect(engine.profiles.analyst.description).toBe('New')
    })
  })

  describe('confirmModel', () => {
    it('should apply a confirmed model', async () => {
      engine.expensiveModels.add('big')
      await confirmModel(backend, 'analyst', { provider: 'custom', model: 'big' })
      expect(engine.configured).toEqual([
        { name: 'analyst', model: 'big', provider: 'custom', confirm_expensive_model: true }
      ])
      expect((await loadDetails(backend, 'analyst')).model).toEqual({
        provider: 'custom',
        model: 'big'
      })
    })
  })
})
