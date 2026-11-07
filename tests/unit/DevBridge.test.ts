import { request } from 'http'
import { createServer } from 'net'
import { describe, it, expect, vi } from 'vitest'
import {
  DevBridge,
  bridgeStartFailure,
  isTrustedBridgeRequest
} from '../../src/main/infrastructure/bridge/DevBridge'

type Handler = (event: unknown, ...args: unknown[]) => unknown

function fakeIpcMain(): {
  handle: (channel: string, fn: Handler) => void
  registered: Map<string, Handler>
} {
  const registered = new Map<string, Handler>()
  return {
    handle: (channel: string, fn: Handler) => registered.set(channel, fn),
    registered
  }
}

describe('DevBridge', () => {
  it('should record handlers in the tap and still delegate registration to ipcMain', async () => {
    const bridge = new DevBridge(5173)
    const ipc = fakeIpcMain()
    bridge.installTap(ipc)
    const handler = vi.fn().mockResolvedValue(42)
    ipc.handle('settings:set', handler)
    expect(ipc.registered.get('settings:set')).toBe(handler)
    const reply = await bridge.dispatchInvoke('settings:set', [['f'], { deep: true }])
    expect(handler).toHaveBeenCalledWith(expect.anything(), ['f'], { deep: true })
    expect(reply).toEqual({ ok: true, result: 42 })
  })

  it('should reject channels that were never registered', async () => {
    const bridge = new DevBridge(5173)
    const reply = await bridge.dispatchInvoke('nope:never', [])
    expect(reply.ok).toBe(false)
    expect(reply.error).toContain('nope:never')
  })

  it('should convert a throwing handler into ok:false', async () => {
    const bridge = new DevBridge(5173)
    const ipc = fakeIpcMain()
    bridge.installTap(ipc)
    ipc.handle('theme:set-native', vi.fn().mockRejectedValue(new Error('settings unreadable')))
    const reply = await bridge.dispatchInvoke('theme:set-native', ['b1'])
    expect(reply).toEqual({ ok: false, error: 'settings unreadable' })
  })

  it('should route event.sender.send from handlers into broadcast', async () => {
    const bridge = new DevBridge(5173)
    const ipc = fakeIpcMain()
    bridge.installTap(ipc)
    const events: Array<{ channel: string; args: unknown[] }> = []
    bridge.onBroadcast((channel, ...args) => events.push({ channel, args }))
    ipc.handle('example:run', async (event) => {
      const e = event as { sender: { send: (ch: string, ...a: unknown[]) => void } }
      e.sender.send('example:progress', { done: 1 })
      return 'ok'
    })
    await bridge.dispatchInvoke('example:run', [])
    expect(events).toEqual([{ channel: 'example:progress', args: [{ done: 1 }] }])
  })

  it('should dispatch successfully to a handler that checks event.sender.isDestroyed', async () => {
    const bridge = new DevBridge(5173)
    const ipc = fakeIpcMain()
    bridge.installTap(ipc)
    ipc.handle('example:download', async (event) => {
      const e = event as { sender: { isDestroyed: () => boolean } }
      return { destroyed: e.sender.isDestroyed() }
    })
    const reply = await bridge.dispatchInvoke('example:download', [])
    expect(reply).toEqual({ ok: true, result: { destroyed: false } })
  })
})

describe('isTrustedBridgeRequest', () => {
  const ports = { bridgePort: 5175, rendererPort: 5173 }
  const json = { 'content-type': 'application/json' }

  it.each([
    ['the Vite proxy, no Origin', { host: '127.0.0.1:5175', ...json }, true],
    [
      'the dev renderer',
      { host: '127.0.0.1:5175', origin: 'http://localhost:5173', ...json },
      true
    ],
    [
      'the renderer on IPv6 loopback',
      { host: 'localhost:5175', origin: 'http://[::1]:5173', ...json },
      true
    ],
    ['another site', { host: '127.0.0.1:5175', origin: 'https://evil.example', ...json }, false],
    [
      'another local port',
      { host: '127.0.0.1:5175', origin: 'http://localhost:8080', ...json },
      false
    ],
    ['a rebound DNS name', { host: 'evil.example:5175', ...json }, false],
    ['a missing Host', { ...json }, false],
    ['a text/plain body', { host: '127.0.0.1:5175', 'content-type': 'text/plain' }, false]
  ])('should judge a POST from %s as %s', (_label, headers, expected) => {
    expect(isTrustedBridgeRequest({ method: 'POST', headers }, ports)).toBe(expected)
  })

  it('should accept the event stream GET without a content type', () => {
    expect(
      isTrustedBridgeRequest({ method: 'GET', headers: { host: '127.0.0.1:5175' } }, ports)
    ).toBe(true)
  })
})

describe('DevBridge over HTTP', () => {
  function freePort(): Promise<number> {
    return new Promise((resolve) => {
      const probe = createServer()
      probe.listen(0, '127.0.0.1', () => {
        const { port } = probe.address() as { port: number }
        probe.close(() => resolve(port))
      })
    })
  }

  function post(port: number, headers: Record<string, string>): Promise<number> {
    return new Promise((resolve, reject) => {
      const req = request(
        { host: '127.0.0.1', port, path: '/bridge/invoke', method: 'POST', headers },
        (res) => {
          res.resume()
          res.on('end', () => resolve(res.statusCode ?? 0))
        }
      )
      req.on('error', reject)
      req.end(JSON.stringify({ channel: 'settings:get', args: [] }))
    })
  }

  async function withBridge(
    run: (port: number, handler: ReturnType<typeof vi.fn>) => Promise<void>
  ): Promise<void> {
    const bridge = new DevBridge(5173)
    const ipc = fakeIpcMain()
    bridge.installTap(ipc)
    const handler = vi.fn().mockResolvedValue('/home')
    ipc.handle('settings:get', handler)
    const port = await freePort()
    await bridge.start(port)
    try {
      await run(port, handler)
    } finally {
      await bridge.stop()
    }
  }

  it('should answer 403 and not run the handler for a cross-site POST', async () => {
    await withBridge(async (port, handler) => {
      const status = await post(port, {
        origin: 'https://evil.example',
        'content-type': 'application/json'
      })
      expect(status).toBe(403)
      expect(handler).not.toHaveBeenCalled()
    })
  })

  it('should run the handler for a loopback POST from the dev renderer', async () => {
    await withBridge(async (port, handler) => {
      const status = await post(port, {
        origin: 'http://localhost:5173',
        'content-type': 'application/json'
      })
      expect(status).toBe(200)
      expect(handler).toHaveBeenCalledOnce()
    })
  })

  it('should tell a tab which renderer it serves', async () => {
    await withBridge(async (port) => {
      const response = await fetch(`http://127.0.0.1:${port}/bridge/hello`)
      expect(await response.json()).toEqual({ rendererPort: 5173 })
    })
  })

  it('should name the port and the way out when another dev run holds it', async () => {
    await withBridge(async (port) => {
      const second = new DevBridge(5174)
      const failure = await second.start(port).catch((error: unknown) => error)
      expect(bridgeStartFailure(failure, port)).toBe(
        `[DevBridge] Port ${port} is taken, probably by another dev run: the browser renderer cannot reach this app. Start both runs with a free TALYX_BRIDGE_PORT.`
      )
    })
  })
})
