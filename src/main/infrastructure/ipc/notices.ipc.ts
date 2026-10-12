import { ipcMain } from 'electron'
import type { ProactiveScheduler } from '../../domain/briefing/services/ProactiveScheduler'
import { settingsStore } from '../storage/SettingsStore'
import { announceNotices } from '../notices/NoticeDelivery'
import { pauseNoticesForToday } from '../notices/pauseNotices'

/** Settings' "Show me one now": the briefing regardless of the clock or what was already said. */
export function registerNoticesIpc(scheduler: ProactiveScheduler): void {
  // Switching notices on is the one moment the macOS permission question makes
  // sense, so that is when Talyx asks it.
  ipcMain.handle('notices:announce', () => announceNotices())
  ipcMain.handle(
    'notices:preview',
    async (): Promise<{ delivered: boolean }> => ({
      delivered: await scheduler.briefNow()
    })
  )
  ipcMain.handle('notices:pause-today', () => {
    pauseNoticesForToday(settingsStore)
  })
  ipcMain.handle('notices:resume', () => {
    settingsStore.set({ noticesPausedUntil: null })
  })
}
