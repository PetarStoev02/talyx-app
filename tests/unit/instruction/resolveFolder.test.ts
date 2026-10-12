import { describe, it, expect } from 'vitest'
import { join } from 'path'
import { homedir, platform } from 'os'
import { resolveFolder } from '../../../src/main/domain/instruction/model/resolveFolder'
import { UnresolvableFolderError } from '../../../src/main/domain/instruction/model/errors'

const home = homedir()

describe('resolveFolder', () => {
  it('should pass an absolute path through unchanged', () => {
    expect(resolveFolder('/tmp/demo')).toBe('/tmp/demo')
  })

  it('should expand a leading tilde to the home directory', () => {
    expect(resolveFolder('~/Projects')).toBe(join(home, 'Projects'))
  })

  it('should resolve the home directory itself', () => {
    expect(resolveFolder('~')).toBe(home)
  })

  it.each([
    ['downloads', 'Downloads'],
    ['Downloads', 'Downloads'],
    ['my downloads', 'Downloads'],
    ['the downloads folder', 'Downloads'],
    ['desktop', 'Desktop'],
    ['documents', 'Documents'],
    ['pictures', 'Pictures'],
    ['music', 'Music'],
    ['movies', 'Movies']
  ])('should resolve the spoken name %s to the real folder', (spoken, expected) => {
    expect(resolveFolder(spoken)).toBe(join(home, expected))
  })

  it('should treat videos as whatever the platform calls its video folder', () => {
    expect(resolveFolder('videos')).toBe(join(home, platform() === 'darwin' ? 'Movies' : 'Videos'))
  })

  it('should reject a relative path rather than resolving it against the process directory', () => {
    expect(() => resolveFolder('./stuff')).toThrow(UnresolvableFolderError)
  })

  it('should reject a bare name that is not a known folder', () => {
    expect(() => resolveFolder('quarterly')).toThrow(UnresolvableFolderError)
  })

  it('should reject an empty reference', () => {
    expect(() => resolveFolder('   ')).toThrow(UnresolvableFolderError)
  })

  it('should name the reference it could not resolve', () => {
    expect(() => resolveFolder('quarterly')).toThrow(/quarterly/)
  })
})
