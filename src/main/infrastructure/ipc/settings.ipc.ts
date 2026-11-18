import { UserSettingsPartialSchema } from '@contract/channels'
import type { PageSettings, UserSettings } from '@contract/settings'
import { settingsStore } from '../storage/SettingsStore'
import { setLaunchAtLogin, systemLoginItemDeps } from '../system/loginItem'
import { handle } from './handle'
import { validateInput } from './validation'

export function registerSettingsIpc(): void {
  handle('settings:get', () => forPage(settingsStore.store))

  handle('settings:set', async (_event, rawPartial: unknown) => {
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

/** The settings without the license key (PageSettings says why). */
function forPage(settings: UserSettings): PageSettings {
  const page: Partial<UserSettings> = { ...settings }
  delete page.licenseKey
  return page as PageSettings
}
