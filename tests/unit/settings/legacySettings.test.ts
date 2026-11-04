import { describe, it, expect } from 'vitest'
import { migrateSettings } from '../../../src/main/infrastructure/storage/SettingsStore'

describe('migrateSettings', () => {
  it('should start a fresh install on the system theme with the sidebar open', () => {
    expect(migrateSettings({})).toEqual({ theme: 'system', sidebarCollapsed: false })
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
    expect(migrated).toEqual({ theme: 'dark', sidebarCollapsed: true })
  })
})
