// Typed wrappers around window.api exposed by preload
import { toast } from 'sonner'
import { t } from '@shared/lib/i18n'
import { problemOf } from '@shared/lib/problem'
import { reportError } from '@shared/lib/report'
import type { InstallExit, InstallSteps } from '../../../../shared/setup'
import type { UpdateState } from '../../../../shared/updater'

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  sidebarWidth: number
  lastSelection: { kind: 'bot' | 'room'; id: string } | null
  setupDone: boolean
  launchAtLogin: boolean
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

export const setupApi = {
  installSteps: (): Promise<InstallSteps> => window.api.getInstallSteps() as Promise<InstallSteps>,
  runInstall: (): Promise<void> => window.api.runInstall() as Promise<void>,
  cancelInstall: (): Promise<void> => window.api.cancelInstall() as Promise<void>,
  onOutput: (cb: (index: number, text: string) => void): (() => void) =>
    window.api.onInstallOutput(cb),
  onExit: (cb: (exit: InstallExit) => void): (() => void) => window.api.onInstallExit(cb)
}

export const updaterApi = {
  state: (): Promise<UpdateState> => window.api.getUpdateState() as Promise<UpdateState>,
  download: (): Promise<void> => window.api.downloadUpdate() as Promise<void>,
  cancel: (): Promise<void> => window.api.cancelUpdate() as Promise<void>,
  install: (): Promise<void> => window.api.installUpdate() as Promise<void>,
  onState: (cb: (state: UpdateState) => void): (() => void) => window.api.onUpdateState(cb)
}
