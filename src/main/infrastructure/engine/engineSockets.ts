import type { Engine } from './engine'

const MAX_SOCKETS = 16

export type SocketEventSink = (
  channel: 'engine:socket-frame' | 'engine:socket-closed',
  ...args: unknown[]
) => void

/**
 * Gateway websockets opened by main, relayed to the renderer over IPC. The gateway admits a native
 * socket only without an Origin header and with the one-use ticket in a subprotocol, which a page
 * cannot do; main can, and the ticket never reaches the renderer. The renderer picks the socket id
 * before opening, so frames that arrive before the open call returns still find their socket.
 */
export class EngineSockets {
  private readonly sockets = new Map<string, WebSocket>()

  constructor(private readonly engine: Engine) {}

  async open(id: string, profile: string, sink: SocketEventSink): Promise<void> {
    if (this.sockets.has(id)) throw new Error('Engine socket id already in use')
    // One window keeps one socket. A page that went away without closing its own (a dev-bridge
    // browser tab has no lifecycle events) must not lock out the next one: drop the oldest.
    if (this.sockets.size >= MAX_SOCKETS) this.close(this.sockets.keys().next().value!)
    const { endpoint, wire, ticket } = await this.engine.mint(profile, 'interactive')
    const url = `${endpoint.api_origin.replace(/^http/, 'ws')}/api/ws`
    const socket = new WebSocket(url, [wire.wsProtocol, `${wire.wsTicketPrefix}${ticket}`])
    this.sockets.set(id, socket)
    socket.addEventListener('message', (event) => {
      if (typeof event.data === 'string') sink('engine:socket-frame', id, event.data)
    })
    socket.addEventListener('close', (event) => {
      this.sockets.delete(id)
      sink('engine:socket-closed', id, event.code, event.reason)
    })
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener('open', () => resolve(), { once: true })
      socket.addEventListener('error', () => reject(new Error('Engine socket failed to open')), {
        once: true
      })
    })
  }

  send(id: string, text: string): void {
    const socket = this.sockets.get(id)
    if (!socket || socket.readyState !== WebSocket.OPEN)
      throw new Error('Engine socket is not open')
    socket.send(text)
  }

  close(id: string): void {
    this.sockets.get(id)?.close()
  }

  closeAll(): void {
    for (const socket of this.sockets.values()) socket.close()
  }
}
