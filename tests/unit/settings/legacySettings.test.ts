import { describe, it, expect } from 'vitest'
import { migrateSettings } from '../../../src/main/infrastructure/storage/SettingsStore'

describe('migrateSettings', () => {
  it('should start a fresh install on the system theme with the sidebar at its first width', () => {
    expect(migrateSettings({})).toEqual({
      theme: 'system',
      sidebarWidth: 320,
      enginePath: null
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
    expect(migrated).toEqual({ theme: 'dark', sidebarWidth: 320, enginePath: null })
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
    ['a relative path', 'talyx-engine'],
    ['a number', 42]
  ])('should ignore a hand-edited engine path that is %s', (_case, enginePath) => {
    expect(migrateSettings({ enginePath }).enginePath).toBeNull()
  })

  it('should keep an absolute engine path', () => {
    expect(migrateSettings({ enginePath: '/opt/engine/cli' }).enginePath).toBe('/opt/engine/cli')
  })
})
