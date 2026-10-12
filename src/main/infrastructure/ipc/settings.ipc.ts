import { ipcMain } from 'electron'
import { settingsStore } from '../storage/SettingsStore'
import type { ClassificationPipeline } from '../../domain/classification/services/ClassificationPipeline'
import { validateInput, UserSettingsPartialSchema } from './validation'

export function registerSettingsIpc(pipeline: ClassificationPipeline): void {
  ipcMain.handle('settings:get', () => {
    return settingsStore.store
  })

  ipcMain.handle('settings:set', (_event, rawPartial: unknown) => {
    const partial = validateInput(UserSettingsPartialSchema, rawPartial)
    settingsStore.set(partial)
    // Refresh custom rules whenever settings change
    const updated = settingsStore.store
    pipeline.setCustomRules(updated.classificationRules ?? [])
    return updated
  })
}
