import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import type { KokoroVoice } from '../../domain/ai/voicePresets'
import type { NoticeKind } from '../../domain/briefing/model/Notice'

export interface ClassificationRule {
  extension: string
  category: string
  subcategory: string | null
}

export interface SortPreset {
  name: string
  sourcePath: string
  outputPath: string
  mode: 'copy' | 'move'
}

export interface UserSettings {
  defaultSortMode: 'copy' | 'move'
  defaultOutputDir: string | null
  theme: 'light' | 'dark' | 'system'
  hasSeenOnboarding: boolean
  hasSeenTour: boolean
  hasCompletedFirstSort: boolean
  classificationRules: ClassificationRule[]
  sortPresets: SortPreset[]
  appLanguage: string
  updateFrequency: 'daily' | 'weekly' | 'manual'
  assistantHotkeyEnabled: boolean
  /** null means ~/Code */
  projectsRoot: string | null
  /** A model id from the current brain's catalog; an unknown id falls back to the catalog default. */
  assistantModel: string
  /** Which brain answers: the user's API key, or their installed Claude Code. */
  assistantProvider: 'api-key' | 'claude-code'
  /** Explicit path to the claude binary; null means auto-detect. */
  claudeCodePath: string | null
  sidebarCollapsed: boolean
  /** The file tools are folded away until the owner opens them. */
  filesGroupOpen: boolean
  voiceEnabled: boolean
  voiceHotkey: 'Alt+Space' | 'Control+Space' | 'Shift+Space'
  voiceSttModel: 'fast' | 'accurate'
  voiceSpeakReplies: boolean
  /** Which engine speaks English replies. Kokoro falls back to the system voice until installed. */
  voiceTtsEngine: 'kokoro' | 'system'
  voiceTtsVoice: KokoroVoice
  /** Answer out loud instead of on screen: the orb replies, the text does not appear. */
  voiceMode: boolean
  /** Which sorter reads the user's files: fully local, or their own Claude. */
  sorterSource: 'smart-local' | 'claude'
  /** The master switch for everything Talyx says without being asked. */
  noticesEnabled: boolean
  /** When the morning briefing goes out, 'HH:MM' in the owner's own timezone. */
  briefingTime: string
  /** 'facts' assembles the briefing for free; 'written' spends a model turn having it narrated. */
  briefingStyle: 'facts' | 'written'
  noticeKinds: Record<NoticeKind, boolean>
  /** Whether macOS has already been asked to allow notifications. It only ever asks once. */
  noticesPermissionAsked: boolean
  /** The last fingerprint delivered per notice kind. Runtime state, so nothing repeats across a restart. */
  noticeMarks: Record<string, string>
  /** Day stamp when a day-pause expires; null means notices are not paused. */
  noticesPausedUntil: string | null
}

const defaults: UserSettings = {
  defaultSortMode: 'move',
  defaultOutputDir: null,
  theme: 'system',
  hasSeenOnboarding: false,
  hasSeenTour: false,
  hasCompletedFirstSort: false,
  classificationRules: [],
  sortPresets: [],
  appLanguage: 'en',
  updateFrequency: 'daily',
  assistantHotkeyEnabled: true,
  projectsRoot: null,
  assistantModel: 'claude-opus-5',
  assistantProvider: 'api-key',
  claudeCodePath: null,
  sidebarCollapsed: false,
  filesGroupOpen: false,
  voiceEnabled: true,
  voiceHotkey: 'Alt+Space',
  voiceSttModel: 'fast',
  voiceSpeakReplies: false,
  voiceTtsEngine: 'kokoro',
  voiceTtsVoice: 'bm_lewis',
  voiceMode: false,
  sorterSource: 'smart-local',
  noticesEnabled: false,
  briefingTime: '08:00',
  briefingStyle: 'facts',
  noticeKinds: { briefing: true, disk: true, meeting: true, agenda: true, clutter: true },
  noticesPermissionAsked: false,
  noticeMarks: {},
  noticesPausedUntil: null
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/** Settings that did something in older versions; dropped so they don't linger in the file. */
const REMOVED_KEYS: readonly string[] = [
  'analyticsOptIn',
  'namingPattern',
  'deepAnalysis',
  'defaultTemplateId',
  'localAiPreset',
  'localAiModelsReady',
  'ocrLanguage',
  'earlyAccessBannerDismissed'
]

/**
 * Applies one-time migrations to raw settings JSON, then merges over the defaults.
 * Pure function so migrations are testable without touching Electron's `app`.
 */
export function migrateSettings(raw: Record<string, unknown>): UserSettings {
  const data = { ...raw }
  if ('quickSearchEnabled' in data && !('assistantHotkeyEnabled' in data)) {
    data.assistantHotkeyEnabled = data.quickSearchEnabled
  }
  delete data.quickSearchEnabled
  for (const key of REMOVED_KEYS) delete data[key]
  if (!('sorterSource' in data) || data.sorterSource === 'talyx-models') {
    data.sorterSource = 'smart-local'
  }
  return { ...defaults, ...data } as UserSettings
}

function read(): UserSettings {
  try {
    const data = JSON.parse(readFileSync(getSettingsPath(), 'utf-8')) as Record<string, unknown>
    return migrateSettings(data)
  } catch {
    return { ...defaults }
  }
}

function write(settings: UserSettings): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2))
}

export type SettingsStore = typeof settingsStore

export const settingsStore = {
  get store(): UserSettings {
    return read()
  },
  set(partial: Partial<UserSettings>): void {
    const current = read()
    write({ ...current, ...partial })
  }
}
