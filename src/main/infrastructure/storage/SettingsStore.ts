import { app } from 'electron'
import { isAbsolute, join } from 'path'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import log from 'electron-log'
import { SIDEBAR_WIDTH, clampSidebarWidth } from '../../../shared/sidebar'
import { LastSelectionSchema } from '../ipc/validation'

export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  sidebarWidth: number
  /** Absolute path to the engine's command, picked by the user; null means look it up. */
  enginePath: string | null
  /** The bot or room open when Talyx last ran, opened again on launch; null on a first run. */
  lastSelection: { kind: 'bot' | 'room'; id: string } | null
  /** True once the first-run setup has finished or been skipped; false shows it again. */
  setupDone: boolean
}

const defaults: UserSettings = {
  theme: 'system',
  sidebarWidth: SIDEBAR_WIDTH.initial,
  enginePath: null,
  lastSelection: null,
  setupDone: false
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
  if (!LastSelectionSchema.nullable().safeParse(settings.lastSelection).success)
    settings.lastSelection = null
  if (typeof settings.setupDone !== 'boolean') settings.setupDone = false
  return settings
}

function read(): UserSettings {
  const path = getSettingsPath()
  let text: string
  try {
    text = readFileSync(path, 'utf-8')
  } catch {
    // No file yet: a fresh install.
    return { ...defaults }
  }
  try {
    return migrateSettings(JSON.parse(text) as Record<string, unknown>)
  } catch (error) {
    // Kept aside, not overwritten by the next save: it may hold an engine path worth recovering.
    const aside = `${path}.corrupt-${Date.now()}`
    try {
      renameSync(path, aside)
      log.warn(`[Settings] settings.json was unreadable; moved to ${aside}`, error)
    } catch (renameError) {
      log.error('[Settings] settings.json is unreadable and could not be moved aside', renameError)
    }
    return { ...defaults }
  }
}

// Written to a temporary file and renamed over the old one, so a crash mid-write never leaves
// half a file behind.
function write(settings: UserSettings): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  const path = getSettingsPath()
  writeFileSync(`${path}.tmp`, JSON.stringify(settings, null, 2))
  renameSync(`${path}.tmp`, path)
}

export const settingsStore = {
  get store(): UserSettings {
    return read()
  },
  set(partial: Partial<UserSettings>): void {
    write({ ...read(), ...partial })
  }
}
