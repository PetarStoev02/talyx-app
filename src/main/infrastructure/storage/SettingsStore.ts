import { dirname } from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

export interface UserSettings {
  theme: 'dark'
  currentProjectId: string | null
  /** Minutes without activity before a bot is shown as stale. */
  staleMinutes: number
  launchAtLogin: boolean
  funnelEnabled: boolean
}

const DEFAULTS: UserSettings = {
  theme: 'dark',
  currentProjectId: null,
  staleMinutes: 15,
  launchAtLogin: false,
  funnelEnabled: false
}

const SETTING_KEYS = Object.keys(DEFAULTS) as Array<keyof UserSettings>

/** JSON-file settings. Keys a past version wrote are dropped on read, so old files load cleanly. */
export class SettingsStore {
  constructor(private readonly filePath: string) {}

  get(): UserSettings {
    return { ...DEFAULTS, ...this.readKnownKeys() }
  }

  update(patch: Partial<UserSettings>): UserSettings {
    const next = { ...this.get(), ...patch }
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(next, null, 2))
    return next
  }

  private readKnownKeys(): Partial<UserSettings> {
    let raw: Record<string, unknown>
    try {
      raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Record<string, unknown>
    } catch {
      // Missing or unreadable file: start from the defaults.
      return {}
    }
    return Object.fromEntries(SETTING_KEYS.filter((key) => key in raw).map((k) => [k, raw[k]]))
  }
}
