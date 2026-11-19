// Wrappers around window.api, grouped by area. buildApi types each call from the channel table
// (@contract/channels); a return type here that disagrees with it does not compile.
import { toast } from 'sonner'
import { t } from '@shared/lib/i18n'
import { problemOf } from '@shared/lib/problem'
import { reportError } from '@shared/lib/report'
import type { UsageDays } from '@contract/engine'
import type { SettingsChange, Theme } from '@contract/channels'
import type { PageSettings } from '@contract/settings'
import type { InstallExit, InstallSteps } from '@contract/setup'
import type { UpdateCheck, UpdateState } from '@contract/updater'
import type { ActivationRequest, AvailableModule, ModulesState } from '@contract/modules'
import type { McpAnswer, McpCall, McpConnection } from '@contract/mcp'

export const settingsApi = {
  get: (): Promise<PageSettings> => window.api.getSettings(),
  set: (partial: SettingsChange): Promise<PageSettings> => window.api.setSettings(partial),
  /**
   * Saves a change the screen already shows (a theme, a sidebar width): nothing waits on it, so a
   * failure is logged and told in a toast here. The toast is English only, as i18n.ts says.
   */
  save: (partial: SettingsChange): void => {
    settingsApi.set(partial).catch((error: unknown) => {
      reportError('settings', error)
      toast.error(t('settings.errorSave', 'en'), {
        description: problemOf(error).detail ?? undefined,
        duration: Infinity
      })
    })
  }
}

/** The theme pick: saved like any setting, and the native chrome (menus, dialogs) follows it. */
export const themeApi = {
  get: settingsApi.get,
  save: ({ theme }: { theme: Theme }): void => {
    settingsApi.save({ theme })
    // Cosmetic: a failure is only logged.
    window.api.setNativeTheme(theme).catch((error: unknown) => reportError('theme', error))
  }
}

export const setupApi = {
  installSteps: (): Promise<InstallSteps> => window.api.getInstallSteps(),
  runInstall: (): Promise<void> => window.api.runInstall(),
  cancelInstall: (): Promise<void> => window.api.cancelInstall(),
  onOutput: (cb: (index: number, text: string) => void): (() => void) =>
    window.api.onInstallOutput(cb),
  onExit: (cb: (exit: InstallExit) => void): (() => void) => window.api.onInstallExit(cb)
}

export const updaterApi = {
  state: (): Promise<UpdateState> => window.api.getUpdateState(),
  check: (): Promise<UpdateCheck> => window.api.checkForUpdate(),
  download: (): Promise<void> => window.api.downloadUpdate(),
  cancel: (): Promise<void> => window.api.cancelUpdate(),
  install: (): Promise<void> => window.api.installUpdate(),
  onState: (cb: (state: UpdateState) => void): (() => void) => window.api.onUpdateState(cb)
}

export const appApi = {
  version: (): Promise<string> => window.api.getAppVersion(),
  diagnostics: (engine: string): Promise<string> => window.api.getDiagnostics(engine)
}

export const filesApi = {
  keep: (file: { name: string; dataUrl: string }): Promise<string> => window.api.keepFile(file)
}

export const modulesApi = {
  state: (): Promise<ModulesState> => window.api.getModulesState(),
  takeActivationRequest: (): Promise<ActivationRequest | null> =>
    window.api.takeActivationRequest(),
  activate: (key: string): Promise<ModulesState> => window.api.activateLicense(key),
  deactivate: (): Promise<ModulesState> => window.api.deactivateLicense(),
  available: (): Promise<AvailableModule[]> => window.api.getAvailableModules(),
  install: (id: string): Promise<ModulesState> => window.api.installModule(id),
  uninstall: (id: string): Promise<ModulesState> => window.api.uninstallModule(id),
  invoke: (id: string, action: string, input: unknown): Promise<unknown> =>
    window.api.invokeModule(id, action, input),
  onState: (cb: (state: ModulesState) => void): (() => void) => window.api.onModulesState(cb),
  onActivationRequested: (cb: () => void): (() => void) => window.api.onActivationRequested(cb)
}

export const mcpApi = {
  attach: (): Promise<void> => window.api.attachMcp(),
  answer: (id: string, answer: McpAnswer): Promise<void> => window.api.answerMcp(id, answer),
  connection: (): Promise<McpConnection> => window.api.getMcpConnection(),
  onCall: (cb: (call: McpCall) => void): (() => void) => window.api.onMcpCall(cb)
}

/** The engine config write its REST cannot make: one model off a bot's custom endpoint. */
export const engineConfigApi = {
  removeEndpointModel: (drop: {
    profile: string
    endpoint: string
    model: string
  }): Promise<void> => window.api.removeEndpointModel(drop)
}

/** Usage per day and provider, which Talyx's engine plugin reads in main: the REST has neither. */
export const engineUsageApi = {
  usageDays: (request: { profiles: string[]; days: number }): Promise<UsageDays> =>
    window.api.usageDays(request)
}
