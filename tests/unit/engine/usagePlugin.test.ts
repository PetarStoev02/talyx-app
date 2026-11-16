import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PLUGIN = resolve('resources/engine-plugin/talyx-usage/__init__.py')
const CHECK = resolve('tests/unit/engine/usagePluginCheck.py')

describe('the usage engine plugin', () => {
  // Python without bytecode files (-B) and without the working folder on its path (-I).
  it("should read each bot's days by the engine's per-model rules", () => {
    const out = execFileSync('python3', ['-I', '-B', CHECK, PLUGIN], { encoding: 'utf8' })
    expect(out.trim()).toBe('ok')
  })
})
