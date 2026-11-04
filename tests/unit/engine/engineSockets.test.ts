import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Engine } from '../../../src/main/infrastructure/engine/engine'
import { EngineSockets } from '../../../src/main/infrastructure/engine/engineSockets'

/** Records what main would put on the wire; opens on the next tick like a real socket. */
class FakeSocket extends EventTarget {
  static readonly OPEN = 1
  static opened: FakeSocket[] = []
  readyState = 0
  closed = false
  constructor(
    readonly url: string,
    readonly protocols: string[]
  ) {
    super()
    FakeSocket.opened.push(this)
    setTimeout(() => {
      this.readyState = 1
      this.dispatchEvent(new Event('open'))
    }, 0)
  }
  send(): void {}
  close(): void {
    if (this.closed) return
    this.closed = true
    this.readyState = 3
    this.dispatchEvent(Object.assign(new Event('close'), { code: 1000, reason: '' }))
  }
}

function socketsWithFakeEngine(): EngineSockets {
  const engine = {
    mint: async () => ({
      endpoint: { api_origin: 'http://127.0.0.1:4567' },
      wire: { wsProtocol: 'acme-gateway-v1', wsTicketPrefix: 'acme-gateway-ticket.' },
      ticket: 't-1'
    })
  } as unknown as Engine
  return new EngineSockets(engine)
}

describe('engine sockets', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    FakeSocket.opened = []
  })

  it('should dial the gateway with the protocol and the one-use ticket as subprotocols', async () => {
    vi.stubGlobal('WebSocket', FakeSocket)
    await socketsWithFakeEngine().open('socket-0001', 'default', () => undefined)
    expect(FakeSocket.opened[0].url).toBe('ws://127.0.0.1:4567/api/ws')
    expect(FakeSocket.opened[0].protocols).toEqual(['acme-gateway-v1', 'acme-gateway-ticket.t-1'])
  })

  it('should refuse a socket id that is already open', async () => {
    vi.stubGlobal('WebSocket', FakeSocket)
    const sockets = socketsWithFakeEngine()
    await sockets.open('socket-0001', 'default', () => undefined)
    await expect(sockets.open('socket-0001', 'default', () => undefined)).rejects.toThrow(
      'Engine socket id already in use'
    )
  })

  it('should close the oldest socket when a 17th opens, and report its close', async () => {
    vi.stubGlobal('WebSocket', FakeSocket)
    const sockets = socketsWithFakeEngine()
    const closes: unknown[] = []
    const sink = (channel: string, id: unknown): void => {
      if (channel === 'engine:socket-closed') closes.push(id)
    }
    for (let i = 0; i < 16; i++) await sockets.open(`socket-${1000 + i}`, 'default', sink)
    await sockets.open('socket-2000', 'default', sink)
    expect(FakeSocket.opened[0].closed).toBe(true)
    expect(FakeSocket.opened.filter((socket) => socket.closed)).toHaveLength(1)
    expect(closes).toEqual(['socket-1000'])
  })

  it('should refuse a send to a socket that is not open', () => {
    expect(() => socketsWithFakeEngine().send('socket-0001', '{}')).toThrow(
      'Engine socket is not open'
    )
  })
})
