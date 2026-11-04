import { describe, it, expect } from 'vitest'
import {
  validateInput,
  UserSettingsPartialSchema
} from '../../../src/main/infrastructure/ipc/validation'

describe('UserSettingsPartialSchema', () => {
  it.each(['light', 'dark', 'system'] as const)('should accept the %s theme', (theme) => {
    expect(validateInput(UserSettingsPartialSchema, { theme })).toEqual({ theme })
  })

  it('should accept an empty change', () => {
    expect(validateInput(UserSettingsPartialSchema, {})).toEqual({})
  })

  it('should reject an unknown theme', () => {
    expect(() => validateInput(UserSettingsPartialSchema, { theme: 'blue' })).toThrow()
  })

  it('should reject a sidebar state that is not a boolean', () => {
    expect(() => validateInput(UserSettingsPartialSchema, { sidebarCollapsed: 'yes' })).toThrow()
  })

  it('should drop settings this version does not have', () => {
    expect(validateInput(UserSettingsPartialSchema, { voiceEnabled: true })).toEqual({})
  })
})
