import { execFileSync } from 'child_process'
import { describe, expect, it } from 'vitest'
import { VENDORED_ENGINE_FILES } from '../../eslint.vendored.mjs'

// Built from parts so this file does not contain the characters it searches for.
const EM_DASH = String.fromCharCode(0x2014)
const MAX_GREP_OUTPUT_BYTES = 16 * 1024 * 1024
const BANNED_SPELLINGS = [EM_DASH, '\\' + 'u2014', '&m' + 'dash;']

describe('em dash', () => {
  it('should appear in no tracked or new file outside the vendored engine files', () => {
    let hits = ''
    try {
      hits = execFileSync(
        'git',
        [
          'grep',
          '-nI',
          '--untracked',
          '--fixed-strings',
          ...BANNED_SPELLINGS.flatMap((spelling) => ['-e', spelling]),
          '--',
          '.',
          ':(exclude)**/package-lock.json',
          ...VENDORED_ENGINE_FILES.map((file) => `:(exclude,glob)${file}`)
        ],
        { encoding: 'utf8', maxBuffer: MAX_GREP_OUTPUT_BYTES }
      )
    } catch (err) {
      // git grep exits 1 when nothing matches; any other failure (bad pathspec, no git,
      // output too large) must fail the test instead of passing it vacuously.
      if ((err as { status?: number }).status !== 1) throw err
    }
    expect(hits.trim().split('\n').filter(Boolean)).toEqual([])
  })
})
