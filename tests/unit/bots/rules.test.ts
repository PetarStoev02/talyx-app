import { beforeEach, describe, expect, it } from 'vitest'
import type { RosterBackend } from '../../../src/renderer/src/features/bots/data'
import { createBot } from '../../../src/renderer/src/features/bots/create'
import { TALYX_RULES, fillInRules } from '../../../src/renderer/src/features/bots/rules'
import { backendFor, engineDouble } from './engineDouble'
import type { EngineDouble } from './engineDouble'

const OLDER_RULES = '# Talyx\n\nTalyx is the app you live in.'

let engine: EngineDouble
let backend: RosterBackend

beforeEach(() => {
  engine = engineDouble()
  backend = backendFor(engine)
})

describe('telling bots they live in Talyx', () => {
  describe('creating a bot', () => {
    it('should write the rules into the new bot and leave its SOUL as created', async () => {
      const id = await createBot(
        backend,
        {
          name: 'Scout',
          folder: null,
          model: null,
          look: { shape: 'stair', hue: 1, faces: false },
          purpose: null
        },
        []
      )

      expect(engine.prompts[id]).toBe(TALYX_RULES)
      expect(engine.profiles[id].soul).toBe(engine.created[0].soul)
      expect(engine.configured).toEqual([])
    })
  })

  describe('fillInRules', () => {
    it('should write the rules into every existing bot that has none', async () => {
      const missed = await fillInRules(backend, ['default', 'analyst'])

      expect(missed).toEqual([])
      expect(engine.prompts).toEqual({ default: TALYX_RULES, analyst: TALYX_RULES })
    })

    it('should leave a bot that already has the current rules alone', async () => {
      engine.prompts.analyst = TALYX_RULES

      await fillInRules(backend, ['default', 'analyst'])

      expect(engine.promptWrites).toEqual(['default'])
    })

    it('should rewrite a bot that has an older version of the rules', async () => {
      engine.prompts.analyst = OLDER_RULES

      await fillInRules(backend, ['analyst'])

      expect(engine.prompts.analyst).toBe(TALYX_RULES)
    })

    it('should keep a prompt the user wrote', async () => {
      engine.prompts.analyst = 'Answer in French.'

      await fillInRules(backend, ['analyst'])

      expect(engine.prompts.analyst).toBe('Answer in French.')
      expect(engine.promptWrites).toEqual([])
    })

    it('should never write a SOUL', async () => {
      await fillInRules(backend, ['default', 'analyst'])

      expect(engine.configured).toEqual([])
      expect(engine.profiles.analyst.soul).toBe('# Analyst')
    })

    it('should report a bot that did not take the rules and still fill in the rest', async () => {
      const missed = await fillInRules(backend, ['gone', 'analyst'])

      expect(missed).toEqual(['gone'])
      expect(engine.prompts.analyst).toBe(TALYX_RULES)
    })

    it('should do nothing with no bots', async () => {
      expect(await fillInRules(backend, [])).toEqual([])
      expect(engine.promptWrites).toEqual([])
    })
  })
})
