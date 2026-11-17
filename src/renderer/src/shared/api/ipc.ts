// Typed wrappers around window.api exposed by preload
import { toast } from 'sonner'
import { t } from '@shared/lib/i18n'
import { problemOf } from '@shared/lib/problem'
import { reportError } from '@shared/lib/report'
import type { InstallExit, InstallSteps } from '@contract/setup'
import type { UpdateCheck, UpdateState } from '@contract/updater'
import type { ActivationRequest, AvailableModule, ModulesState } from '@contract/modules'
import type { McpAnswer, McpCall, McpConnection } from '@contract/mcp'

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  sidebarWidth: number
  lastSelection: { kind: 'bot' | 'room'; id: string } | null
  setupDone: boolean
  launchAtLogin: boolean
  completionSound: boolean
}

export const settingsApi = {
  get: (): Promise<AppSettings> => window.api.getSettings() as Promise<AppSettings>,
  set: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    window.api.setSettings(partial as Record<string, unknown>) as Promise<AppSettings>,
  /**
   * Saves a change the screen already shows (a theme, a sidebar width): nothing waits on it, so a
   * failure is logged and told in a toast here. The toast is English only, as i18n.ts says.
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
  check: (): Promise<UpdateCheck> => window.api.checkForUpdate() as Promise<UpdateCheck>,
  download: (): Promise<void> => window.api.downloadUpdate() as Promise<void>,
  cancel: (): Promise<void> => window.api.cancelUpdate() as Promise<void>,
  install: (): Promise<void> => window.api.installUpdate() as Promise<void>,
  onState: (cb: (state: UpdateState) => void): (() => void) => window.api.onUpdateState(cb)
}

export const appApi = {
  version: (): Promise<string> => window.api.getAppVersion() as Promise<string>,
  diagnostics: (engine: string): Promise<string> =>
    window.api.getDiagnostics(engine) as Promise<string>
}

export const filesApi = {
  keep: (file: { name: string; dataUrl: string }): Promise<string> =>
    window.api.keepFile(file) as Promise<string>
}

export const modulesApi = {
  state: (): Promise<ModulesState> => window.api.getModulesState() as Promise<ModulesState>,
  takeActivationRequest: (): Promise<ActivationRequest | null> =>
    window.api.takeActivationRequest() as Promise<ActivationRequest | null>,
  activate: (key: string): Promise<ModulesState> =>
    window.api.activateLicense(key) as Promise<ModulesState>,
  deactivate: (): Promise<ModulesState> => window.api.deactivateLicense() as Promise<ModulesState>,
  available: (): Promise<AvailableModule[]> =>
    window.api.getAvailableModules() as Promise<AvailableModule[]>,
  install: (id: string): Promise<ModulesState> =>
    window.api.installModule(id) as Promise<ModulesState>,
  uninstall: (id: string): Promise<ModulesState> =>
    window.api.uninstallModule(id) as Promise<ModulesState>,
  invoke: (id: string, action: string, input: unknown): Promise<unknown> =>
    window.api.invokeModule(id, action, input),
  onState: (cb: (state: ModulesState) => void): (() => void) => window.api.onModulesState(cb),
  onActivationRequested: (cb: () => void): (() => void) => window.api.onActivationRequested(cb)
}

export const mcpApi = {
  attach: (): Promise<void> => window.api.attachMcp() as Promise<void>,
  answer: (id: string, answer: McpAnswer): Promise<void> =>
    window.api.answerMcp(id, answer) as Promise<void>,
  connection: (): Promise<McpConnection> => window.api.getMcpConnection(),
  onCall: (cb: (call: McpCall) => void): (() => void) => window.api.onMcpCall(cb)
}

/** The engine config write its REST cannot make: one model off a bot's custom endpoint. */
export const engineConfigApi = {
  removeEndpointModel: (drop: {
    profile: string
    endpoint: string
    model: string
  }): Promise<void> => window.api.removeEndpointModel(drop) as Promise<void>
}

/** One day of one bot's usage with one billing provider, as Talyx's engine plugin reads it. */
export interface BotDayRow {
  day: string
  provider: string | null
  input_tokens: number | null
  output_tokens: number | null
  api_calls: number | null
}

/** A bot's days, or why its store could not be read. */
export type BotDays = { rows: BotDayRow[] } | { error: string }

/** Usage per day and provider, which Talyx's engine plugin reads in main: the REST has neither. */
export const engineUsageApi = {
  usageDays: (request: { profiles: string[]; days: number }): Promise<Record<string, BotDays>> =>
    window.api.usageDays(request) as Promise<Record<string, BotDays>>
}
