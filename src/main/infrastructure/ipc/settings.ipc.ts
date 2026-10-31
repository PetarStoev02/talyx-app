import { ipcMain } from 'electron'
import type { SettingsStore } from '../storage/SettingsStore'
import { validateInput, UserSettingsPartialSchema } from './validation'

export function registerSettingsIpc(settingsStore: SettingsStore): void {
  ipcMain.handle('settings:get', () => settingsStore.get())

  ipcMain.handle('settings:set', (_event, rawPatch: unknown) =>
    settingsStore.update(validateInput(UserSettingsPartialSchema, rawPatch))
  )
}
