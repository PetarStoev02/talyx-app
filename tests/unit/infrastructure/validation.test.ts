import { describe, it, expect } from 'vitest'
import {
  EngineHttpRequestSchema,
  EnginePathSchema,
  RendererErrorSchema,
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

  it.each([
    ['not a number', 'wide'],
    ['below the minimum', 100],
    ['above the maximum', 2000]
  ])('should reject a sidebar width that is %s', (_case, sidebarWidth) => {
    expect(() => validateInput(UserSettingsPartialSchema, { sidebarWidth })).toThrow()
  })

  it('should accept a finished setup', () => {
    expect(validateInput(UserSettingsPartialSchema, { setupDone: true })).toEqual({
      setupDone: true
    })
  })

  it('should reject a setup flag that is not a boolean', () => {
    expect(() => validateInput(UserSettingsPartialSchema, { setupDone: 'yes' })).toThrow()
  })

  it.each([true, false])('should accept launch at login %s', (launchAtLogin) => {
    expect(validateInput(UserSettingsPartialSchema, { launchAtLogin })).toEqual({ launchAtLogin })
  })

  it('should reject a launch-at-login flag that is not a boolean', () => {
    expect(() => validateInput(UserSettingsPartialSchema, { launchAtLogin: 'yes' })).toThrow()
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

describe('RendererErrorSchema', () => {
  it('should take a renderer failure for the log', () => {
    const report = { scope: 'chat', message: 'Error: boom' }
    expect(validateInput(RendererErrorSchema, report)).toEqual(report)
  })

  it.each([
    ['a message longer than the cap', { scope: 'chat', message: 'x'.repeat(8001) }],
    ['a missing scope', { message: 'boom' }]
  ])('should refuse %s', (_case, report) => {
    expect(() => validateInput(RendererErrorSchema, report)).toThrow()
  })
})
