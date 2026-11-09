// Single source of truth for the window.api surface. The preload builds it
// over ipcRenderer; the browser dev bridge builds it over HTTP+SSE. Must not
// import 'electron': it compiles in both the node and web tsconfigs.

import type { EngineHttpRequest } from './engine'
import type { ModulesState } from './modules'
import type { InstallExit } from './setup'
import type { UpdateState } from './updater'

export interface ApiTransport {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, listener: (...args: unknown[]) => void) => () => void
}

// Electron rejects an invoke with "Error invoking remote method 'x': Error: message"; only the
// message is the handler's, and the rest must never reach the screen.
const IPC_PREFIX = /^Error invoking remote method '[^']*': (?:[A-Za-z]*Error: )?/

/** The handler's own message from a rejected invoke, without Electron's wrapping. */
export function ipcErrorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(IPC_PREFIX, '')
}

// The return type is deliberately inferred: it IS the definition of TalyxApi
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function buildApi(transport: ApiTransport) {
  const invoke = (channel: string, ...args: unknown[]): Promise<unknown> =>
    transport.invoke(channel, ...args).catch((error: unknown) => {
      throw new Error(ipcErrorMessage(error))
    })
  return {
    // Settings
    getSettings: () => invoke('settings:get'),
    setSettings: (partial: Record<string, unknown>) => invoke('settings:set', partial),
    setNativeTheme: (theme: string) => invoke('theme:set-native', theme),

    // Engine (the gateway socket and REST calls run in main, which holds the tickets)
    getEngineStatus: () => invoke('engine:status'),
    pickEnginePath: () => invoke('engine:pick-path'),
    useInstalledEngine: () => invoke('engine:use-installed'),
    engineHttp: (request: EngineHttpRequest) => invoke('engine:http', request),
    openEngineSocket: (id: string, profile: string) => invoke('engine:socket-open', id, profile),
    sendEngineSocket: (id: string, text: string) => invoke('engine:socket-send', id, text),
    closeEngineSocket: (id: string) => invoke('engine:socket-close', id),
    onEngineSocketFrame: (callback: (id: string, text: string) => void) =>
      transport.on('engine:socket-frame', (id, text) => callback(id as string, text as string)),
    onEngineSocketClosed: (callback: (id: string, code: number, reason: string) => void) =>
      transport.on('engine:socket-closed', (id, code, reason) =>
        callback(id as string, code as number, reason as string)
      ),

    // Engine install (main runs only the pinned steps it loaded itself)
    getInstallSteps: () => invoke('setup:install-steps'),
    runInstall: () => invoke('setup:install-run'),
    cancelInstall: () => invoke('setup:install-cancel'),
    onInstallOutput: (callback: (index: number, text: string) => void) =>
      transport.on('setup:install-output', (index, text) =>
        callback(index as number, text as string)
      ),
    onInstallExit: (callback: (exit: InstallExit) => void) =>
      transport.on('setup:install-exit', (exit) => callback(exit as InstallExit)),

    // A renderer failure, written to Talyx's log file by main
    logError: (report: { scope: string; message: string }) => invoke('log:error', report),

    // About Talyx: its version, and the redacted diagnostics report for a bug report
    getAppVersion: () => invoke('app:version'),
    getDiagnostics: (engine: string) => invoke('app:diagnostics', engine),

    // Talyx update (main picks, downloads and verifies the release; the page only asks)
    getUpdateState: () => invoke('updater:status'),
    downloadUpdate: () => invoke('updater:download'),
    cancelUpdate: () => invoke('updater:cancel'),
    installUpdate: () => invoke('updater:install'),
    onUpdateState: (callback: (state: UpdateState) => void) =>
      transport.on('updater:state', (state) => callback(state as UpdateState)),

    // Modules (main checks the license and every module's signature; the page names ids only)
    getModulesState: () => invoke('modules:state'),
    takeActivationRequest: () => invoke('modules:take-activation'),
    activateLicense: (key: string) => invoke('modules:activate', key),
    deactivateLicense: () => invoke('modules:deactivate'),
    getAvailableModules: () => invoke('modules:available'),
    installModule: (id: string) => invoke('modules:install', id),
    uninstallModule: (id: string) => invoke('modules:uninstall', id),
    invokeModule: (id: string, action: string, input: unknown) =>
      invoke('modules:invoke', id, action, input),
    onModulesState: (callback: (state: ModulesState) => void) =>
      transport.on('modules:state', (state) => callback(state as ModulesState)),
    onActivationRequested: (callback: () => void) =>
      transport.on('modules:activation-requested', () => callback())
  }
}

export type TalyxApi = ReturnType<typeof buildApi>
