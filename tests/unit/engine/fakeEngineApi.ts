import { vi } from 'vitest'

export interface JsonRpcFrame {
  jsonrpc?: string
  id: number | string
  method: string
  params: Record<string, unknown>
}

/** Answers one client frame with a result, or `undefined` for no reply. */
export type FakeGateway = (
  frame: JsonRpcFrame,
  socket: { push: (frame: object) => void }
) => unknown

/**
 * A stand-in for main's engine:socket-* channels on `window.api`: frames the renderer sends go to
 * `gateway`, and its answers come back as socket frames, the way main relays a real gateway.
 */
export function installFakeEngineApi(gateway: FakeGateway): {
  sent: JsonRpcFrame[]
  opened: string[]
  dropAll: () => void
} {
  const frameListeners = new Set<(id: string, text: string) => void>()
  const closedListeners = new Set<(id: string, code: number, reason: string) => void>()
  const open = new Set<string>()
  const sent: JsonRpcFrame[] = []
  const opened: string[] = []
  const emit = (id: string, frame: object): void => {
    for (const listener of frameListeners) listener(id, JSON.stringify(frame))
  }
  const api = {
    openEngineSocket: async (id: string, profile: string) => {
      open.add(id)
      opened.push(profile)
    },
    sendEngineSocket: async (id: string, text: string) => {
      const frame = JSON.parse(text) as JsonRpcFrame
      if (frame.method === 'client.capabilities') {
        emit(id, { jsonrpc: '2.0', id: frame.id, result: { server_requests: [] } })
        return
      }
      sent.push(frame)
      const result = await gateway(frame, { push: (event) => emit(id, event) })
      if (result !== undefined) emit(id, { jsonrpc: '2.0', id: frame.id, result })
    },
    closeEngineSocket: async (id: string) => {
      open.delete(id)
    },
    onEngineSocketFrame: (listener: (id: string, text: string) => void) => {
      frameListeners.add(listener)
      return () => frameListeners.delete(listener)
    },
    onEngineSocketClosed: (listener: (id: string, code: number, reason: string) => void) => {
      closedListeners.add(listener)
      return () => closedListeners.delete(listener)
    }
  }
  vi.stubGlobal('window', { api })
  return {
    sent,
    opened,
    dropAll: () => {
      for (const id of open) for (const listener of closedListeners) listener(id, 1006, 'dropped')
      open.clear()
    }
  }
}
