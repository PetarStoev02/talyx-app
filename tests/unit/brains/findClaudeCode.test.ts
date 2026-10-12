import { describe, it, expect } from 'vitest'
import { findClaudeCode } from '../../../src/main/infrastructure/brains/findClaudeCode'

function existsOnly(...present: string[]): (p: string) => boolean {
  return (p) => present.includes(p)
}

describe('findClaudeCode', () => {
  it('should prefer the configured path when it exists', () => {
    const found = findClaudeCode({
      configured: '/custom/claude',
      home: '/Users/p',
      pathEnv: '/usr/bin',
      exists: existsOnly('/custom/claude', '/opt/homebrew/bin/claude')
    })
    expect(found).toBe('/custom/claude')
  })

  it('should fall through when the configured path is missing', () => {
    const found = findClaudeCode({
      configured: '/gone/claude',
      home: '/Users/p',
      pathEnv: undefined,
      exists: existsOnly('/usr/local/bin/claude')
    })
    expect(found).toBe('/usr/local/bin/claude')
  })

  it('should try the fixed install locations in order before PATH', () => {
    const found = findClaudeCode({
      configured: null,
      home: '/Users/p',
      pathEnv: '/somewhere/bin',
      exists: existsOnly('/somewhere/bin/claude', '/Users/p/.local/bin/claude')
    })
    expect(found).toBe('/Users/p/.local/bin/claude')
  })

  it('should scan every PATH entry last', () => {
    const found = findClaudeCode({
      configured: null,
      home: '/Users/p',
      pathEnv: '/usr/bin:/a/bin:/b/bin',
      exists: existsOnly('/b/bin/claude')
    })
    expect(found).toBe('/b/bin/claude')
  })

  it('should return null when nothing exists', () => {
    const found = findClaudeCode({
      configured: null,
      home: '/Users/p',
      pathEnv: '',
      exists: () => false
    })
    expect(found).toBeNull()
  })
})
