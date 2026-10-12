import { describe, it, expect } from 'vitest'
import { migrateSettings } from '../../../src/main/infrastructure/storage/SettingsStore'

describe('migrateSettings', () => {
  it('should put a ready install on smart local, not talyx models', () => {
    const settings = migrateSettings({ localAiModelsReady: true })
    expect(settings.sorterSource).toBe('smart-local')
  })

  it('should migrate an explicit talyx-models choice to smart-local', () => {
    const settings = migrateSettings({ sorterSource: 'talyx-models' })
    expect(settings.sorterSource).toBe('smart-local')
  })

  it('should put a fresh install on smart local', () => {
    expect(migrateSettings({}).sorterSource).toBe('smart-local')
  })

  it('should leave an explicit claude choice alone', () => {
    const settings = migrateSettings({ localAiModelsReady: true, sorterSource: 'claude' })
    expect(settings.sorterSource).toBe('claude')
  })
})
