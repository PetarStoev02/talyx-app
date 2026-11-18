// Single source of truth for the window.api surface. The preload builds it
// over ipcRenderer; the browser dev bridge builds it over HTTP+SSE. Must not
// import 'electron': it compiles in both the node and web tsconfigs.

import type {
  EventChannel,
  EventChannels,
  InvokeChannel,
  InvokeInput,
  InvokeOutput
} from './channels'

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
  // The one place a reply is typed: main's handler for the channel answers its output (handle()).
  const invoke = <C extends InvokeChannel>(
    channel: C,
    ...args: InvokeInput<C>
  ): Promise<InvokeOutput<C>> =>
    transport.invoke(channel, ...args).then(
      (reply) => reply as InvokeOutput<C>,
      (error: unknown) => {
        throw new Error(ipcErrorMessage(error))
      }
    )
  const on = <C extends EventChannel>(
    channel: C,
    callback: (...args: EventChannels[C]) => void
  ): (() => void) => transport.on(channel, (...args) => callback(...(args as EventChannels[C])))
  return {
    // Settings
    getSettings: () => invoke('settings:get'),
    setSettings: (partial: InvokeInput<'settings:set'>[0]) => invoke('settings:set', partial),
    setNativeTheme: (theme: InvokeInput<'theme:set-native'>[0]) =>
      invoke('theme:set-native', theme),

    // Engine (the gateway socket and REST calls run in main, which holds the tickets)
    getEngineStatus: () => invoke('engine:status'),
    pickEnginePath: () => invoke('engine:pick-path'),
    useInstalledEngine: () => invoke('engine:use-installed'),
    engineHttp: (request: InvokeInput<'engine:http'>[0]) => invoke('engine:http', request),
    setRoomMembers: (change: InvokeInput<'engine:room-members'>[0]) =>
      invoke('engine:room-members', change),
    removeEndpointModel: (removal: InvokeInput<'engine:endpoint-model-remove'>[0]) =>
      invoke('engine:endpoint-model-remove', removal),
    usageDays: (request: InvokeInput<'engine:usage-days'>[0]) =>
      invoke('engine:usage-days', request),
    openEngineSocket: (id: string, profile: string) => invoke('engine:socket-open', id, profile),
    sendEngineSocket: (id: string, text: string) => invoke('engine:socket-send', id, text),
    closeEngineSocket: (id: string) => invoke('engine:socket-close', id),
    onEngineSocketFrame: (callback: (...args: EventChannels['engine:socket-frame']) => void) =>
      on('engine:socket-frame', callback),
    onEngineSocketClosed: (callback: (...args: EventChannels['engine:socket-closed']) => void) =>
      on('engine:socket-closed', callback),

    // Engine install (main runs only the pinned steps it loaded itself)
    getInstallSteps: () => invoke('setup:install-steps'),
    runInstall: () => invoke('setup:install-run'),
    cancelInstall: () => invoke('setup:install-cancel'),
    onInstallOutput: (callback: (...args: EventChannels['setup:install-output']) => void) =>
      on('setup:install-output', callback),
    onInstallExit: (callback: (...args: EventChannels['setup:install-exit']) => void) =>
      on('setup:install-exit', callback),

    // A renderer failure, written to Talyx's log file by main
    logError: (report: InvokeInput<'log:error'>[0]) => invoke('log:error', report),

    // About Talyx: its version, and the redacted diagnostics report for a bug report
    getAppVersion: () => invoke('app:version'),
    getDiagnostics: (engine: string) => invoke('app:diagnostics', engine),

    // A copy of a dropped or pasted file with no path of its own, so a bot can open it by path
    keepFile: (file: InvokeInput<'files:keep'>[0]) => invoke('files:keep', file),

    // Talyx update (main picks, downloads and verifies the release; the page only asks)
    getUpdateState: () => invoke('updater:status'),
    checkForUpdate: () => invoke('updater:check'),
    downloadUpdate: () => invoke('updater:download'),
    cancelUpdate: () => invoke('updater:cancel'),
    installUpdate: () => invoke('updater:install'),
    onUpdateState: (callback: (...args: EventChannels['updater:state']) => void) =>
      on('updater:state', callback),

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
    onModulesState: (callback: (...args: EventChannels['modules:state']) => void) =>
      on('modules:state', callback),
    onActivationRequested: (callback: () => void) => on('modules:activation-requested', callback),

    // Talyx's MCP server (main serves agents; this page runs their tool calls and answers)
    attachMcp: () => invoke('mcp:attach'),
    answerMcp: (id: string, answer: InvokeInput<'mcp:answer'>[1]) =>
      invoke('mcp:answer', id, answer),
    getMcpConnection: () => invoke('mcp:connection'),
    onMcpCall: (callback: (...args: EventChannels['mcp:call']) => void) => on('mcp:call', callback)
  }
}

export type TalyxApi = ReturnType<typeof buildApi>
