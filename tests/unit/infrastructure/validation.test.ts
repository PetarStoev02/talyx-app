import { describe, it, expect } from 'vitest'
import {
  EngineHttpRequestSchema,
  EnginePathSchema,
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

  it('should never let page code set the engine path', () => {
    expect(validateInput(UserSettingsPartialSchema, { enginePath: '/tmp/x' })).toEqual({})
  })
})

describe('EnginePathSchema', () => {
  it('should accept an absolute path', () => {
    expect(validateInput(EnginePathSchema, '/opt/engine/bin/cli')).toBe('/opt/engine/bin/cli')
  })

  it.each(['talyx-engine', './bin/cli', ''])('should refuse the relative path "%s"', (value) => {
    expect(() => validateInput(EnginePathSchema, value)).toThrow()
  })
})

describe('EngineHttpRequestSchema', () => {
  it('should accept a gateway API path', () => {
    expect(
      validateInput(EngineHttpRequestSchema, { path: '/api/profiles', method: 'GET' })
    ).toEqual({
      path: '/api/profiles',
      method: 'GET'
    })
  })

  it.each(['http://evil.example/api/x', '//evil.example/api', '/other/path'])(
    'should refuse a request that could leave the gateway API (%s)',
    (path) => {
      expect(() => validateInput(EngineHttpRequestSchema, { path })).toThrow()
    }
  )
})
