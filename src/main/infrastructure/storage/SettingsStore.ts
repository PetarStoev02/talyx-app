import { app } from 'electron'
import { isAbsolute, join } from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { SIDEBAR_WIDTH, clampSidebarWidth } from '../../../shared/sidebar'

export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  sidebarWidth: number
  /** Absolute path to the engine's command, picked by the user; null means look it up. */
  enginePath: string | null
}

const defaults: UserSettings = {
  theme: 'system',
  sidebarWidth: SIDEBAR_WIDTH.initial,
  enginePath: null
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/**
 * Keeps only the keys this version knows, so a settings file from the file-organizer
 * era loads cleanly and loses everything it no longer uses on the next write.
 * Pure, so it is testable without Electron's `app`.
 */
export function migrateSettings(raw: Record<string, unknown>): UserSettings {
  const known = Object.fromEntries(
    Object.keys(defaults)
      .filter((key) => key in raw)
      .map((key) => [key, raw[key]])
  )
  const settings = { ...defaults, ...known } as UserSettings
  // Talyx runs this file: a hand-edited value that is not an absolute path is ignored.
  const path: unknown = settings.enginePath
  if (typeof path !== 'string' || !isAbsolute(path)) settings.enginePath = null
  settings.sidebarWidth = clampSidebarWidth(settings.sidebarWidth)
  return settings
}

function read(): UserSettings {
  try {
    const data = JSON.parse(readFileSync(getSettingsPath(), 'utf-8')) as Record<string, unknown>
    return migrateSettings(data)
  } catch {
    // A missing or unreadable file means a fresh install
    return { ...defaults }
  }
}

function write(settings: UserSettings): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2))
}

export const settingsStore = {
  get store(): UserSettings {
    return read()
  },
  set(partial: Partial<UserSettings>): void {
    write({ ...read(), ...partial })
  }
}
