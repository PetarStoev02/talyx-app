import { describe, it, expect } from 'vitest'
import {
  validateInput,
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
    { theme: 'light' },
    { launchAtLogin: 'yes' }
  ])('rejects %j', (patch) => {
    expect(() => validateInput(UserSettingsPartialSchema, patch)).toThrow()
  })
})
