import { describe, it, expect } from 'vitest'
import {
  validateInput,
  ExternalUrlSchema,
  UserSettingsPartialSchema
} from '../../../src/main/infrastructure/ipc/validation'

describe('UserSettingsPartialSchema', () => {
  it('accepts a partial patch', () => {
    expect(validateInput(UserSettingsPartialSchema, { staleMinutes: 30 })).toEqual({
      staleMinutes: 30
    })
  })

  it.each([
    { staleMinutes: 0 },
    { staleMinutes: 1.5 },
    { staleMinutes: 241 },
    { theme: 'light' },
    { launchAtLogin: 'yes' }
  ])('rejects %j', (patch) => {
    expect(() => validateInput(UserSettingsPartialSchema, patch)).toThrow()
  })
})

describe('ExternalUrlSchema', () => {
  it.each(['https://grok.com/chat/1', 'http://127.0.0.1:3773/threads/abc'])('opens %s', (url) => {
    expect(validateInput(ExternalUrlSchema, url)).toBe(url)
  })

  it.each([
    'https://user:pass@x.com/',
    'http://127.0.0.1:3773.evil.com/',
    'http://127.0.0.1:37730/',
    'http://example.com/',
    'file:///etc/passwd',
    'not a url'
  ])('refuses %s', (url) => {
    expect(() => validateInput(ExternalUrlSchema, url)).toThrow()
  })
})
