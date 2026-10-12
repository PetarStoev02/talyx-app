import { describe, it, expect } from 'vitest'
import { migrateSettings } from '../../../src/main/infrastructure/storage/SettingsStore'

describe('legacy settings', () => {
  it('should load an older settings file and drop keys this version no longer has', () => {
    const migrated = migrateSettings({
      analyticsOptIn: true,
      namingPattern: 'type-first',
      deepAnalysis: true,
      defaultTemplateId: 'business',
      localAiPreset: 'balanced',
      localAiModelsReady: true,
      ocrLanguage: 'bul',
      earlyAccessBannerDismissed: true,
      appLanguage: 'bg'
    }) as unknown as Record<string, unknown>
    for (const key of [
      'analyticsOptIn',
      'namingPattern',
      'deepAnalysis',
      'defaultTemplateId',
      'localAiPreset',
      'localAiModelsReady',
      'ocrLanguage',
      'earlyAccessBannerDismissed'
    ]) {
      expect(migrated).not.toHaveProperty(key)
    }
    expect(migrated.appLanguage).toBe('bg')
  })
})
