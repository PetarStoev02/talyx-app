import { execFileSync } from 'child_process'
import { describe, expect, it } from 'vitest'
import { VENDORED_ENGINE_FILES } from '../../eslint.vendored.mjs'

// Built from parts so this file does not contain the characters it searches for.
const EM_DASH = String.fromCharCode(0x2014)
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
        { encoding: 'utf8' }
      )
    } catch {
      // git grep exits 1 when nothing matches
    }
    expect(hits.trim().split('\n').filter(Boolean)).toEqual([])
  })
})
