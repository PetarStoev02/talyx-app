// Single source of truth for the window.api surface. The preload builds it
// over ipcRenderer; the browser dev bridge builds it over HTTP+SSE. Must not
// import 'electron': it compiles in both the node and web tsconfigs.

import type { EngineHttpRequest } from './engine'

export interface ApiTransport {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, listener: (...args: unknown[]) => void) => () => void
}

// The return type is deliberately inferred: it IS the definition of TalyxApi
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function buildApi(transport: ApiTransport) {
  return {
    // Settings
    getSettings: () => transport.invoke('settings:get'),
    setSettings: (partial: Record<string, unknown>) => transport.invoke('settings:set', partial),
    setNativeTheme: (theme: string) => transport.invoke('theme:set-native', theme),

    // Engine (the gateway socket and REST calls run in main, which holds the tickets)
    getEngineStatus: () => transport.invoke('engine:status'),
    pickEnginePath: () => transport.invoke('engine:pick-path'),
    engineHttp: (request: EngineHttpRequest) => transport.invoke('engine:http', request),
    openEngineSocket: (id: string, profile: string) =>
      transport.invoke('engine:socket-open', id, profile),
    sendEngineSocket: (id: string, text: string) =>
      transport.invoke('engine:socket-send', id, text),
    closeEngineSocket: (id: string) => transport.invoke('engine:socket-close', id),
    onEngineSocketFrame: (callback: (id: string, text: string) => void) =>
      transport.on('engine:socket-frame', (id, text) => callback(id as string, text as string)),
    onEngineSocketClosed: (callback: (id: string, code: number, reason: string) => void) =>
      transport.on('engine:socket-closed', (id, code, reason) =>
        callback(id as string, code as number, reason as string)
      ),

    // Updater
    onUpdateAvailable: (callback: (info: { version: string; url: string }) => void) =>
      transport.on('updater:update-available', (info) =>
        callback(info as { version: string; url: string })
      )
  }
}

export type TalyxApi = ReturnType<typeof buildApi>
