import { ipcMain } from 'electron'
import { settingsStore } from '../storage/SettingsStore'
import { validateInput, UserSettingsPartialSchema } from './validation'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => settingsStore.store)

  ipcMain.handle('settings:set', (_event, rawPartial: unknown) => {
    settingsStore.set(validateInput(UserSettingsPartialSchema, rawPartial))
    return settingsStore.store
  })
}
