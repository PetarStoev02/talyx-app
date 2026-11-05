// Single source of truth for the window.api surface. The preload builds it
// over ipcRenderer; the browser dev bridge builds it over HTTP+SSE. Must not
// import 'electron': it compiles in both the node and web tsconfigs.

import type { EngineHttpRequest } from './engine'

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

    // A renderer failure, written to Talyx's log file by main
    logError: (report: { scope: string; message: string }) => invoke('log:error', report),

    // Updater
    onUpdateAvailable: (callback: (info: { version: string; url: string }) => void) =>
      transport.on('updater:update-available', (info) =>
        callback(info as { version: string; url: string })
      )
  }
}

export type TalyxApi = ReturnType<typeof buildApi>
