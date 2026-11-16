import { beforeEach, describe, expect, it } from 'vitest'
import {
  USAGE_PLUGIN,
  USAGE_PLUGIN_FILES,
  usageDays
} from '../../../src/main/infrastructure/engine/usageDays'

const HOME = '/engine-home'

let files: Map<string, string>
let calls: string[][]
let answer: { code: number; stdout: string; stderr: string }

function setup(): ReturnType<typeof usageDays> {
  return usageDays({
    engine: {
      cli: async (args) => {
        calls.push(args)
        return args[0] === USAGE_PLUGIN ? answer : { code: 0, stdout: '', stderr: '' }
      },
      home: async () => HOME
    },
    readFile: async (path) => {
      const text = files.get(path)
      if (text === undefined) throw new Error('ENOENT')
      return text
    },
    writeFile: async (path, text) => {
      files.set(path, text)
    },
    mkdir: async () => undefined
  })
}

const row = {
  day: '2026-11-15',
  provider: 'custom',
  input_tokens: 9,
  output_tokens: 1,
  api_calls: 2
}

beforeEach(() => {
  files = new Map()
  calls = []
  answer = {
    code: 0,
    stdout: `notice\n${JSON.stringify({ ok: true, bots: { default: { rows: [row] }, writer: { error: 'locked' } } })}`,
    stderr: ''
  }
})

describe('usage per day through the engine plugin', () => {
  it("should install the plugin, then read each bot's days for the period", async () => {
    const bots = await setup().read(['default', 'writer'], 30)

    expect(bots).toEqual({ default: { rows: [row] }, writer: { error: 'locked' } })
    for (const [name, text] of Object.entries(USAGE_PLUGIN_FILES))
      expect(files.get(`${HOME}/plugins/${USAGE_PLUGIN}/${name}`)).toBe(text)
    expect(calls.at(-1)).toEqual([
      USAGE_PLUGIN,
      'days',
      '--home',
      HOME,
      '--days',
      '30',
      '--profile',
      'default',
      '--profile',
      'writer'
    ])
  })

  it('should install once when two reads start together', async () => {
    const usage = setup()
    await Promise.all([usage.read(['default'], 7), usage.read(['default'], 30)])
    expect(calls.filter((args) => args[0] === 'plugins')).toHaveLength(1)
  })

  it('should try the install again on the next read after it failed', async () => {
    let refuse = true
    const usage = usageDays({
      engine: {
        cli: async (args) => {
          calls.push(args)
          if (args[0] === 'plugins' && refuse) return { code: 1, stdout: '', stderr: 'retry' }
          return args[0] === USAGE_PLUGIN ? answer : { code: 0, stdout: '', stderr: '' }
        },
        home: async () => HOME
      },
      readFile: async () => '',
      writeFile: async () => undefined,
      mkdir: async () => undefined
    })
    await expect(usage.read(['default'], 7)).rejects.toThrow('retry')
    refuse = false
    await expect(usage.read(['default'], 7)).resolves.toBeTruthy()
  })

  it("should pass on the plugin's own reason when it fails", async () => {
    answer = { code: 1, stdout: '{"ok": false, "error": "no such table"}', stderr: '' }
    await expect(setup().read(['default'], 7)).rejects.toThrow('no such table')
  })

  it('should say what the engine printed when the plugin gave no answer', async () => {
    answer = { code: 2, stdout: '', stderr: 'invalid choice: talyx-usage' }
    await expect(setup().read(['default'], 7)).rejects.toThrow(
      'Usage per day could not be read: invalid choice: talyx-usage'
    )
  })

  it('should refuse an answer that is not the shape it reads', async () => {
    answer = {
      code: 0,
      stdout: '{"ok": true, "bots": {"default": {"rows": [{"day": 3}]}}}',
      stderr: ''
    }
    await expect(setup().read(['default'], 7)).rejects.toThrow()
  })
})
