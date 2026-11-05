// Typed wrappers around window.api exposed by preload
import { toast } from 'sonner'
import { t } from '@shared/lib/i18n'
import { problemOf } from '@shared/lib/problem'
import { reportError } from '@shared/lib/report'

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  sidebarWidth: number
}

export const settingsApi = {
  get: (): Promise<AppSettings> => window.api.getSettings() as Promise<AppSettings>,
  set: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    window.api.setSettings(partial as Record<string, unknown>) as Promise<AppSettings>,
  /**
   * Saves a change the screen already shows (a theme, a sidebar width): nothing waits on it, so a
   * failure is logged and told in a toast here. English only for now, as i18n.ts says.
   */
  save: (partial: Partial<AppSettings>): void => {
    settingsApi.set(partial).catch((error: unknown) => {
      reportError('settings', error)
      toast.error(t('settings.errorSave', 'en'), {
        description: problemOf(error).detail ?? undefined,
        duration: Infinity
      })
    })
  }
}

export const updaterApi = {
  onUpdateAvailable: (cb: (info: { version: string; url: string }) => void): (() => void) =>
    window.api.onUpdateAvailable(cb)
}
