import { postNotification } from './postNotification'
import { nextLocalMidnight } from '../../../shared/notices/pause'
import type { SettingsStore } from '../storage/SettingsStore'

const PAUSED_NOTIFICATION = {
  en: {
    title: 'Notices paused',
    body: 'Until tomorrow. Resume in Settings.'
  },
  bg: {
    title: 'Известията са на пауза',
    body: 'До утре. Възобновете от Настройки.'
  }
} as const

export function pauseNoticesForToday(settingsStore: SettingsStore, now = new Date()): void {
  settingsStore.set({ noticesPausedUntil: nextLocalMidnight(now).toISOString() })
  const lang = settingsStore.store.appLanguage === 'bg' ? 'bg' : 'en'
  const copy = PAUSED_NOTIFICATION[lang]
  postNotification({ title: copy.title, body: copy.body })
}
