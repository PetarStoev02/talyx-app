import { describe, it, expect } from 'vitest'
import { migrateSettings } from '../../../src/main/infrastructure/storage/SettingsStore'

describe('migrateSettings', () => {
  it('should start a fresh install on the system theme with the sidebar open', () => {
    expect(migrateSettings({})).toEqual({
      theme: 'system',
      sidebarCollapsed: false,
      enginePath: null
    })
  })

  it('should keep the theme and sidebar of a file-organizer settings file and drop the rest', () => {
    const migrated = migrateSettings({
      theme: 'dark',
      sidebarCollapsed: true,
      sorterSource: 'claude',
      voiceEnabled: true,
      noticeMarks: { briefing: '2026-01-01' },
      appLanguage: 'bg'
    })
    expect(migrated).toEqual({ theme: 'dark', sidebarCollapsed: true, enginePath: null })
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
