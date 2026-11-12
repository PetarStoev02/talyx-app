import { describe, it, expect, vi } from 'vitest'

// migrateSettings is pure; without the mock, importing the store needs the Electron binary.
vi.mock('electron', () => ({ app: {} }))

import { migrateSettings } from '../../../src/main/infrastructure/storage/SettingsStore'

describe('migrateSettings', () => {
  it('should start a fresh install on the system theme with the sidebar at its first width', () => {
    expect(migrateSettings({})).toEqual({
      theme: 'system',
      sidebarWidth: 320,
      enginePath: null,
      lastSelection: null,
      setupDone: false,
      launchAtLogin: false,
      completionSound: false,
      licenseKey: null
    })
  })

  it('should keep the theme of an older settings file and drop the rest, folding included', () => {
    const migrated = migrateSettings({
      theme: 'dark',
      sidebarCollapsed: true,
      sorterSource: 'claude',
      voiceEnabled: true,
      noticeMarks: { briefing: '2026-01-01' },
      appLanguage: 'bg'
    })
    expect(migrated).toEqual({
      theme: 'dark',
      sidebarWidth: 320,
      enginePath: null,
      lastSelection: null,
      setupDone: false,
      launchAtLogin: false,
      completionSound: false,
      licenseKey: null
    })
  })

  it.each([
    ['below the minimum', 100, 280],
    ['above the maximum', 2000, 480],
    ['between the bounds', 360, 360],
    ['not a number', 'wide', 320]
  ])('should keep a saved sidebar width %s within bounds', (_case, sidebarWidth, expected) => {
    expect(migrateSettings({ sidebarWidth }).sidebarWidth).toBe(expected)
  })

  it.each([
    ['saved as done', true, true],
    ['missing', undefined, false],
    ['a hand-edited string', 'yes', false],
    ['a number', 1, false]
  ])('should read setupDone %s', (_case, setupDone, expected) => {
    expect(migrateSettings({ setupDone }).setupDone).toBe(expected)
  })

  it.each([
    ['saved on', true, true],
    ['missing', undefined, false],
    ['a hand-edited string', 'yes', false]
  ])('should read launchAtLogin %s', (_case, launchAtLogin, expected) => {
    expect(migrateSettings({ launchAtLogin }).launchAtLogin).toBe(expected)
  })

  it.each([
    ['saved on', true, true],
    ['missing', undefined, false],
    ['a hand-edited string', 'yes', false]
  ])('should read completionSound %s', (_case, completionSound, expected) => {
    expect(migrateSettings({ completionSound }).completionSound).toBe(expected)
  })

  it.each([
    ['a relative path', 'talyx-engine'],
    ['a number', 42]
  ])('should ignore a hand-edited engine path that is %s', (_case, enginePath) => {
    expect(migrateSettings({ enginePath }).enginePath).toBeNull()
  })

  it('should keep an absolute engine path', () => {
    expect(migrateSettings({ enginePath: '/opt/engine/cli' }).enginePath).toBe('/opt/engine/cli')
  })

  it.each([
    ['a saved bot', { kind: 'bot', id: 'analyst' }, { kind: 'bot', id: 'analyst' }],
    ['a saved room', { kind: 'room', id: 'r-1' }, { kind: 'room', id: 'r-1' }],
    ['an unknown kind', { kind: 'folder', id: 'x' }, null],
    ['a hand-edited string', 'analyst', null]
  ])('should keep the last chat only when it is %s', (_case, lastSelection, expected) => {
    expect(migrateSettings({ lastSelection }).lastSelection).toEqual(expected)
  })
})
