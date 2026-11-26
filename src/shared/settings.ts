/** settings.json, as main keeps it (storage/SettingsStore.ts). */
export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  /** Where the pages sit: a dock under the sidebar, or a rail beside it with the page as a card. */
  sidebarLayout: 'dock' | 'layered'
  sidebarWidth: number
  /** Absolute path to the engine's command, picked by the user; null means look it up. */
  enginePath: string | null
  /** The bot or room open when Talyx last ran, opened again on launch; null on a first run. */
  lastSelection: { kind: 'bot' | 'room'; id: string } | null
  /** True once the first-run setup has finished or been skipped; false shows it again. */
  setupDone: boolean
  /** Whether the OS starts Talyx at login; main keeps it true to the OS (see index.ts). */
  launchAtLogin: boolean
  /** Play a short sound when a bot finishes a reply. */
  completionSound: boolean
  /** The module license key; set only through `modules:activate`, which checks it first. */
  licenseKey: string | null
}

/**
 * The settings the page sees: never the license key, since module pages run in the app's page and
 * only ever need the license's summary (`modules:state`).
 */
export type PageSettings = Omit<UserSettings, 'licenseKey'>
