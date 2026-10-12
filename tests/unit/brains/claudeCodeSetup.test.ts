import { describe, it, expect } from 'vitest'
import {
  INSTALL_COMMAND,
  parseAuthStatus
} from '../../../src/main/infrastructure/brains/claudeCodeSetup'

describe('INSTALL_COMMAND', () => {
  it('should run only Anthropic own installer over https', () => {
    expect(INSTALL_COMMAND).toBe('curl -fsSL https://claude.ai/install.sh | bash')
  })

  it('should have nothing in it that could come from the owner', () => {
    // The command is shown in Settings before it runs; keep it a constant so
    // what the owner reads is exactly what the shell gets.
    expect(INSTALL_COMMAND).not.toMatch(/\$\{|\$\(|`/)
  })
})

describe('parseAuthStatus', () => {
  it('should read the account out of a signed-in status', () => {
    const json = JSON.stringify({
      loggedIn: true,
      authMethod: 'claude.ai',
      email: 'someone@example.com',
      subscriptionType: 'max'
    })
    expect(parseAuthStatus(json)).toEqual({
      loggedIn: true,
      email: 'someone@example.com',
      plan: 'max'
    })
  })

  it('should report signed out when the CLI says so', () => {
    expect(parseAuthStatus(JSON.stringify({ loggedIn: false }))).toEqual({
      loggedIn: false,
      email: null,
      plan: null
    })
  })

  it.each([
    ['empty output', ''],
    ['a human-readable line', 'Not logged in'],
    ['a JSON array', '[]'],
    ['null', 'null']
  ])('should treat %s as signed out rather than crashing', (_name, output) => {
    expect(parseAuthStatus(output)).toEqual({ loggedIn: false, email: null, plan: null })
  })

  it('should not trust a non-boolean loggedIn', () => {
    expect(parseAuthStatus(JSON.stringify({ loggedIn: 'yes' })).loggedIn).toBe(false)
  })
})
