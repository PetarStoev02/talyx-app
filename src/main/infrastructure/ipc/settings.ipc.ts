import { ipcMain } from 'electron'
import type { SettingsStore, UserSettings } from '../storage/SettingsStore'
import { validateInput, UserSettingsPartialSchema } from './validation'

export function registerSettingsIpc(
  settingsStore: SettingsStore,
  onUpdated: (settings: UserSettings) => void
): void {
  ipcMain.handle('settings:get', () => settingsStore.get())

  ipcMain.handle('settings:set', (_event, rawPatch: unknown) => {
    const next = settingsStore.update(validateInput(UserSettingsPartialSchema, rawPatch))
    onUpdated(next)
    return next
  })
}
