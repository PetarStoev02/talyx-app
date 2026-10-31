// Single source of truth for the window.api surface. The preload builds it
// over ipcRenderer; the browser dev bridge builds it over HTTP+SSE. Must not
// import 'electron' — it compiles in both the node and web tsconfigs.

export interface ApiTransport {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, listener: (...args: unknown[]) => void) => () => void
  getPathForFile: (file: File) => string
}

// The return type is deliberately inferred — it IS the definition of TalyxApi
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function buildApi(transport: ApiTransport) {
  return {
    getSettings: () => transport.invoke('settings:get'),
    updateSettings: (patch: Record<string, unknown>) => transport.invoke('settings:set', patch)
  }
}

export type TalyxApi = ReturnType<typeof buildApi>
