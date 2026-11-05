import { execFileSync } from 'child_process'
import { describe, expect, it } from 'vitest'
import { parseEngineVersion } from '../../src/shared/engine'

/** The engine's real name, from the installed engine itself; null where none is installed (CI). */
function installedEngineName(): string | null {
  try {
    return parseEngineVersion(execFileSync('talyx-engine', ['--version'], { encoding: 'utf8' }))
      .name
  } catch {
    return null
  }
}

const name = installedEngineName()

// The rule: the engine's upstream name appears nowhere in this repo except the README's one
// credit line, so not in git history either. This test never writes it: it asks the engine, then searches the working tree.
describe.skipIf(!name)('engine name', () => {
  it('should appear in no tracked or new file', () => {
    let hits = ''
    try {
      hits = execFileSync(
        'git',
        [
          'grep',
          '-il',
          '--untracked',
          '--fixed-strings',
          name!,
          '--',
          '.',
          ':!package-lock.json',
          ':!README.md'
        ],
        { encoding: 'utf8' }
      )
    } catch {
      // git grep exits 1 when nothing matches
    }
    expect(hits.trim().split('\n').filter(Boolean)).toEqual([])
  })
})
