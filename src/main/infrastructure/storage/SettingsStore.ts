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

const isValid: { [K in keyof UserSettings]: (value: unknown) => value is UserSettings[K] } = {
  theme: (v): v is 'dark' => v === 'dark',
  currentProjectId: (v): v is string | null => v === null || typeof v === 'string',
  staleMinutes: (v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0,
  launchAtLogin: (v): v is boolean => typeof v === 'boolean',
  funnelEnabled: (v): v is boolean => typeof v === 'boolean'
}

const SETTING_KEYS = Object.keys(DEFAULTS) as Array<keyof UserSettings>

/** JSON-file settings. Unknown keys and invalid values from a past version are dropped on read, so old files load cleanly. */
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
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(this.filePath, 'utf-8'))
    } catch {
      // Missing or unreadable file: start from the defaults.
      return {}
    }
    // A hand-edited `null`, number or array must not crash startup.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const raw = parsed as Record<string, unknown>
    return Object.fromEntries(
      SETTING_KEYS.filter((key) => isValid[key](raw[key])).map((k) => [k, raw[k]])
    )
  }
}
