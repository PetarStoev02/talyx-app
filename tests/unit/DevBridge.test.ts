import { request } from 'http'
import { createServer } from 'net'
import { describe, it, expect, vi } from 'vitest'
import { DevBridge, isTrustedBridgeRequest } from '../../src/main/infrastructure/bridge/DevBridge'

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
    ipc.handle('sort:preview', handler)
    expect(ipc.registered.get('sort:preview')).toBe(handler)
    const reply = await bridge.dispatchInvoke('sort:preview', [['f'], { deep: true }])
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
    ipc.handle('sort:undo', vi.fn().mockRejectedValue(new Error('batch missing')))
    const reply = await bridge.dispatchInvoke('sort:undo', ['b1'])
    expect(reply).toEqual({ ok: false, error: 'batch missing' })
  })

  it('should refuse to set the API key over the bridge', async () => {
    const bridge = new DevBridge(5173)
    const ipc = { handle: vi.fn() }
    bridge.installTap(ipc)
    ipc.handle('agent:set-api-key', async () => 'never')
    const reply = await bridge.dispatchInvoke('agent:set-api-key', [{ key: 'k' }])
    expect(reply).toEqual({
      ok: false,
      error: 'agent:set-api-key is not available over the dev bridge'
    })
  })

  it('should route event.sender.send from handlers into broadcast', async () => {
    const bridge = new DevBridge(5173)
    const ipc = fakeIpcMain()
    bridge.installTap(ipc)
    const events: Array<{ channel: string; args: unknown[] }> = []
    bridge.onBroadcast((channel, ...args) => events.push({ channel, args }))
    ipc.handle('sort:execute', async (event) => {
      const e = event as { sender: { send: (ch: string, ...a: unknown[]) => void } }
      e.sender.send('sort:progress', { done: 1 })
      return 'ok'
    })
    await bridge.dispatchInvoke('sort:execute', [])
    expect(events).toEqual([{ channel: 'sort:progress', args: [{ done: 1 }] }])
  })

  it('should dispatch successfully to a handler that checks event.sender.isDestroyed', async () => {
    const bridge = new DevBridge(5173)
    const ipc = fakeIpcMain()
    bridge.installTap(ipc)
    ipc.handle('voice:download-model', async (event) => {
      const e = event as { sender: { isDestroyed: () => boolean } }
      return { destroyed: e.sender.isDestroyed() }
    })
    const reply = await bridge.dispatchInvoke('voice:download-model', [])
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
      req.end(JSON.stringify({ channel: 'folder:home', args: [] }))
    })
  }

  async function withBridge(
    run: (port: number, handler: ReturnType<typeof vi.fn>) => Promise<void>
  ): Promise<void> {
    const bridge = new DevBridge(5173)
    const ipc = fakeIpcMain()
    bridge.installTap(ipc)
    const handler = vi.fn().mockResolvedValue('/home')
    ipc.handle('folder:home', handler)
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
})
