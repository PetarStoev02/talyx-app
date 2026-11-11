import { ipcMain } from 'electron'
import { settingsStore, type UserSettings } from '../storage/SettingsStore'
import { setLaunchAtLogin, systemLoginItemDeps } from '../system/loginItem'
import { validateInput, UserSettingsPartialSchema } from './validation'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => forPage(settingsStore.store))

  ipcMain.handle('settings:set', async (_event, rawPartial: unknown) => {
    const partial = validateInput(UserSettingsPartialSchema, rawPartial)
    // The OS goes first: when it refuses, nothing is saved and the caller sees the failure.
    // What is saved is what the OS reports, which can differ from what was asked for.
    if (partial.launchAtLogin !== undefined) {
      partial.launchAtLogin = await setLaunchAtLogin(partial.launchAtLogin, systemLoginItemDeps())
    }
    settingsStore.set(partial)
    return forPage(settingsStore.store)
  })
}

/**
 * The settings without the license key: module pages run in the app's page, and the page only
 * ever needs the license's summary (modules.ipc.ts), never the key itself.
 */
function forPage(settings: UserSettings): Omit<UserSettings, 'licenseKey'> {
  const page: Partial<UserSettings> = { ...settings }
  delete page.licenseKey
  return page as Omit<UserSettings, 'licenseKey'>
}
