import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UPDATE_FEED_KEY } from '../../../src/main/infrastructure/updater/feedSignature'
import type { FoundRelease } from '../../../src/main/infrastructure/updater/releaseCheck'

type Handler = (event: unknown, ...args: unknown[]) => unknown

const handlers = new Map<string, Handler>()
const electron = vi.hoisted(() => ({
  send: vi.fn(),
  downloadSelfUpdate: vi.fn(),
  restart: vi.fn(async () => undefined)
}))

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, fn: Handler) => handlers.set(channel, fn) },
  app: { getVersion: () => '0.11.0' },
  BrowserWindow: {
    getAllWindows: () => [{ webContents: { send: electron.send, isDestroyed: () => false } }]
  }
}))
vi.mock('electron-log', () => ({ default: { warn: vi.fn(), info: vi.fn() } }))
vi.mock('../../../src/main/infrastructure/updater/selfUpdate', () => ({
  downloadSelfUpdate: electron.downloadSelfUpdate
}))

const RELEASE: FoundRelease = {
  summary: {
    version: '1.0.0',
    url: 'https://github.com/PetarStoev02/talyx-app/releases/tag/v1.0.0',
    publishedAt: '',
    highlights: [],
    changes: 0,
    downloadable: true
  }
}

const invoke = (channel: string, ...args: unknown[]): unknown =>
  handlers.get(channel)!({ sender: {} }, ...args)

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('updater IPC', () => {
  let ipc: typeof import('../../../src/main/infrastructure/ipc/updater.ipc')
  beforeEach(async () => {
    handlers.clear()
    vi.clearAllMocks()
    vi.resetModules()
    electron.downloadSelfUpdate.mockResolvedValue(electron.restart)
    ipc = await import('../../../src/main/infrastructure/ipc/updater.ipc')
    ipc.registerUpdaterIpc()
  })

  it('should report the current state and send every change to the windows', () => {
    expect(invoke('updater:status')).toEqual({ kind: 'none' })
    ipc.updates.found(RELEASE)
    const available = { kind: 'available', release: RELEASE.summary }
    expect(invoke('updater:status')).toEqual(available)
    expect(electron.send).toHaveBeenCalledWith('updater:state', available)
  })

  it('should download only through the feed Talyx signed, whatever the page sends', async () => {
    ipc.updates.found(RELEASE)
    await invoke('updater:download', { url: 'https://evil.example/x.dmg' }, '/tmp/x')
    await settle()

    expect(electron.downloadSelfUpdate).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(AbortSignal),
      { fetch, key: UPDATE_FEED_KEY }
    )
    expect(invoke('updater:status')).toEqual({ kind: 'ready', release: RELEASE.summary })
  })

  it('should refuse to install until a download is verified', async () => {
    ipc.updates.found(RELEASE)
    await expect(invoke('updater:install')).rejects.toThrow('No verified download')
    expect(electron.restart).not.toHaveBeenCalled()
  })

  it('should download only on request and restart only on install', async () => {
    ipc.updates.found(RELEASE)
    await settle()
    expect(electron.downloadSelfUpdate).not.toHaveBeenCalled()

    await invoke('updater:download')
    await settle()
    expect(electron.downloadSelfUpdate).toHaveBeenCalledOnce()
    expect(electron.restart).not.toHaveBeenCalled()

    await invoke('updater:install', '/Applications/Evil.app')
    expect(electron.restart).toHaveBeenCalledOnce()
  })

  it('should cancel a running download', async () => {
    electron.downloadSelfUpdate.mockImplementationOnce(
      (_progress: unknown, signal: AbortSignal) =>
        new Promise((_resolve, reject) => signal.addEventListener('abort', reject))
    )
    ipc.updates.found(RELEASE)
    await invoke('updater:download')
    expect(invoke('updater:status')).toMatchObject({ kind: 'downloading' })

    await invoke('updater:cancel', 'ignored')
    await settle()
    expect(invoke('updater:status')).toEqual({ kind: 'available', release: RELEASE.summary })
  })
})
