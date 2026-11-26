import { describe, it, expect } from 'vitest'
import {
  EngineHttpRequestSchema,
  KeptFileSchema,
  RendererErrorSchema,
  UsageDaysSchema,
  UserSettingsPartialSchema
} from '../../../src/shared/channels'
import { EnginePathSchema, validateInput } from '../../../src/main/infrastructure/ipc/validation'

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

  it.each(['dock', 'layered'])('should accept the sidebar layout %s', (sidebarLayout) => {
    expect(validateInput(UserSettingsPartialSchema, { sidebarLayout })).toEqual({ sidebarLayout })
  })

  it('should refuse a sidebar layout this version does not know', () => {
    expect(() => validateInput(UserSettingsPartialSchema, { sidebarLayout: 'tabs' })).toThrow()
  })

  it.each([true, false])('should accept the completion sound %s', (completionSound) => {
    expect(validateInput(UserSettingsPartialSchema, { completionSound })).toEqual({
      completionSound
    })
  })

  it('should reject a launch-at-login flag that is not a boolean', () => {
    expect(() => validateInput(UserSettingsPartialSchema, { launchAtLogin: 'yes' })).toThrow()
  })

  it('should reject a setting sent as undefined instead of saving it over the stored one', () => {
    expect(() => validateInput(UserSettingsPartialSchema, { theme: undefined })).toThrow()
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

describe('KeptFileSchema', () => {
  it('should take a named file read as a data URL', () => {
    const file = { name: 'invoice.pdf', dataUrl: 'data:application/pdf;base64,JVBERg==' }
    expect(validateInput(KeptFileSchema, file)).toEqual(file)
  })

  it.each([
    ['a name longer than a file system allows', { name: 'x'.repeat(256), dataUrl: 'data:,' }],
    ['a file bigger than the cap', { name: 'big.bin', dataUrl: 'x'.repeat(70_000_001) }],
    ['a missing data URL', { name: 'a.txt' }]
  ])('should refuse %s', (_case, file) => {
    expect(() => validateInput(KeptFileSchema, file)).toThrow()
  })
})

describe('UsageDaysSchema', () => {
  it('should take bot names and a period in days', () => {
    const request = { profiles: ['default', 'agro-ops.cto'], days: 90 }
    expect(validateInput(UsageDaysSchema, request)).toEqual(request)
  })

  it.each([
    ['a name that is a path', { profiles: ['../other'], days: 30 }],
    ['a name that is a flag', { profiles: ['--days'], days: 30 }],
    ['no days', { profiles: ['default'], days: 0 }],
    ['more than a year', { profiles: ['default'], days: 366 }],
    ['part of a day', { profiles: ['default'], days: 1.5 }]
  ])('should refuse %s', (_case, request) => {
    expect(() => validateInput(UsageDaysSchema, request)).toThrow()
  })
})
