import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'

type Handler = (event: unknown, ...args: unknown[]) => unknown

const handlers = new Map<string, Handler>()
const sockets = vi.hoisted(() => ({
  open: vi.fn().mockResolvedValue(undefined),
  send: vi.fn(),
  close: vi.fn()
}))
const settings = vi.hoisted(() => ({ store: { enginePath: null }, set: vi.fn() }))
const files = vi.hoisted(() => ({ existsSync: vi.fn() }))
// No real engine runs: status is a canned answer.
const ATTACHED = { state: 'attached', path: '/somewhere/talyx-engine' }

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, fn: Handler) => handlers.set(channel, fn) },
  BrowserWindow: {},
  dialog: {}
}))
vi.mock('electron-log', () => ({ default: { warn: vi.fn() } }))
vi.mock('../../../src/main/infrastructure/storage/SettingsStore', () => ({
  settingsStore: settings
}))
vi.mock('node:fs', async (original) => ({
  ...(await original<typeof import('node:fs')>()),
  existsSync: files.existsSync
}))
vi.mock('../../../src/main/infrastructure/engine/engine', async (original) => ({
  ...(await original<typeof import('../../../src/main/infrastructure/engine/engine')>()),
  createEngine: () => ({ status: async () => ATTACHED })
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

describe('using the installed engine', () => {
  const installed = join(homedir(), '.local', 'bin', 'talyx-engine')

  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
    registerEngineIpc()
  })

  it('should point Talyx at the engine in the user bin and report the new status', async () => {
    files.existsSync.mockImplementation((path: string) => path === installed)
    expect(await invoke('engine:use-installed', page())).toEqual(ATTACHED)
    expect(settings.set).toHaveBeenCalledWith({ enginePath: installed })
  })

  it('should refuse, and keep the setting, when nothing is installed there', async () => {
    files.existsSync.mockReturnValue(false)
    await expect(invoke('engine:use-installed', page())).rejects.toThrow(
      'No installed engine found'
    )
    expect(settings.set).not.toHaveBeenCalled()
  })

  it('should take no path from the page', async () => {
    files.existsSync.mockReturnValue(true)
    await invoke('engine:use-installed', page(), '/tmp/evil')
    expect(settings.set).toHaveBeenCalledWith({ enginePath: installed })
  })
})
