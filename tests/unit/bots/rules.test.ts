import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { RosterBackend } from '../../../src/renderer/src/features/bots/data'
import { createBot } from '../../../src/renderer/src/features/bots/create'
import {
  PREVIOUS_RULES,
  TALYX_RULES,
  fillInRules
} from '../../../src/renderer/src/features/bots/rules'
import { backendFor, engineDouble } from './engineDouble'
import type { EngineDouble } from './engineDouble'

const OLDER_RULES = '# Talyx\n\nTalyx is the app you live in.'

let engine: EngineDouble
let backend: RosterBackend

beforeEach(() => {
  engine = engineDouble()
  backend = backendFor(engine)
})

afterEach(() => {
  PREVIOUS_RULES.length = 0
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

    it('should rewrite a bot that has an earlier version of the rules', async () => {
      PREVIOUS_RULES.push(OLDER_RULES)
      engine.prompts.analyst = OLDER_RULES

      await fillInRules(backend, ['analyst'])

      expect(engine.prompts.analyst).toBe(TALYX_RULES)
    })

    it.each([
      ['a prompt of only whitespace', ' \n\t'],
      ['an empty list', []]
    ])('should write the rules into a bot whose prompt is %s', async (_, prompt) => {
      engine.prompts.analyst = prompt

      await fillInRules(backend, ['analyst'])

      expect(engine.prompts.analyst).toBe(TALYX_RULES)
    })

    it.each([
      ['a plain prompt', 'Answer in French.'],
      ['a prompt under the same heading', '# Talyx\n\nAnswer in French.'],
      ['the rules with lines the user added', `${TALYX_RULES}\nAnswer in French.`],
      ['a prompt written as a list', ['Answer in French.', 'Be brief.']]
    ])('should keep %s the user wrote', async (_, prompt) => {
      engine.prompts.analyst = prompt

      await fillInRules(backend, ['analyst'])

      expect(engine.prompts.analyst).toEqual(prompt)
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

describe('fillInRules over a fake backend', () => {
  it("should leave the user's own prompt alone and fill in a blank one", async () => {
    const prompts: Record<string, unknown> = { own: 'Be terse.', blank: '  ' }
    const writes: [string, string][] = []
    await fillInRules(
      {
        readPrompt: async (profile) => prompts[profile],
        writePrompt: async (profile, prompt) => void writes.push([profile, prompt])
      },
      ['own', 'blank']
    )
    expect(writes).toEqual([['blank', TALYX_RULES]])
  })
})
