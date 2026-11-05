import { describe, it, expect, vi, beforeEach } from 'vitest'

type Handler = (event: unknown, ...args: unknown[]) => unknown

const handlers = new Map<string, Handler>()
const sockets = vi.hoisted(() => ({
  open: vi.fn().mockResolvedValue(undefined),
  send: vi.fn(),
  close: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, fn: Handler) => handlers.set(channel, fn) },
  BrowserWindow: {},
  dialog: {}
}))
vi.mock('electron-log', () => ({ default: { warn: vi.fn() } }))
vi.mock('../../../src/main/infrastructure/storage/SettingsStore', () => ({
  settingsStore: { store: { enginePath: null } }
}))
vi.mock('../../../src/main/infrastructure/engine/engineSockets', () => ({
  EngineSockets: class {
    open = sockets.open
    send = sockets.send
    close = sockets.close
  }
}))

import { registerEngineIpc } from '../../../src/main/infrastructure/ipc/engine.ipc'

function page(): { sender: { send: () => void; isDestroyed: () => boolean } } {
  return { sender: { send: () => undefined, isDestroyed: () => false } }
}

const invoke = (channel: string, event: unknown, ...args: unknown[]): unknown =>
  handlers.get(channel)!(event, ...args)

describe('engine socket ownership', () => {
  const ID = 'socket-0001'

  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
    registerEngineIpc()
  })

  it('should let the page that opened a socket send on it and close it', async () => {
    const owner = page()
    await invoke('engine:socket-open', owner, ID, 'default')
    invoke('engine:socket-send', owner, ID, 'hello')
    invoke('engine:socket-close', owner, ID)
    expect(sockets.send).toHaveBeenCalledWith(ID, 'hello')
    expect(sockets.close).toHaveBeenCalledWith(ID)
  })

  it("should refuse another page's send and ignore its close", async () => {
    await invoke('engine:socket-open', page(), ID, 'default')
    const other = page()
    expect(() => invoke('engine:socket-send', other, ID, 'hello')).toThrow(
      'Engine socket is not open'
    )
    invoke('engine:socket-close', other, ID)
    expect(sockets.send).not.toHaveBeenCalled()
    expect(sockets.close).not.toHaveBeenCalled()
  })

  it('should forget a socket that failed to open', async () => {
    const owner = page()
    sockets.open.mockRejectedValueOnce(new Error('Engine socket failed to open'))
    await expect(invoke('engine:socket-open', owner, ID, 'default')).rejects.toThrow()
    expect(() => invoke('engine:socket-send', owner, ID, 'hello')).toThrow(
      'Engine socket is not open'
    )
  })
})
