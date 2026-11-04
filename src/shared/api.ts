// Single source of truth for the window.api surface. The preload builds it
// over ipcRenderer; the browser dev bridge builds it over HTTP+SSE. Must not
// import 'electron': it compiles in both the node and web tsconfigs.

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

    // Updater
    onUpdateAvailable: (callback: (info: { version: string; url: string }) => void) =>
      transport.on('updater:update-available', (info) =>
        callback(info as { version: string; url: string })
      )
  }
}

export type TalyxApi = ReturnType<typeof buildApi>
