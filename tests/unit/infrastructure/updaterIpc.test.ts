import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FoundRelease } from '../../../src/main/infrastructure/updater/releaseCheck'

type Handler = (event: unknown, ...args: unknown[]) => unknown

const handlers = new Map<string, Handler>()
const electron = vi.hoisted(() => ({
  send: vi.fn(),
  openPath: vi.fn(async () => ''),
  showItemInFolder: vi.fn(),
  chmod: vi.fn(async () => undefined),
  downloadRelease: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, fn: Handler) => handlers.set(channel, fn) },
  app: { getPath: (name: string) => `/home/me/${name}` },
  shell: { openPath: electron.openPath, showItemInFolder: electron.showItemInFolder },
  BrowserWindow: {
    getAllWindows: () => [{ webContents: { send: electron.send, isDestroyed: () => false } }]
  }
}))
vi.mock('fs/promises', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  chmod: electron.chmod
}))
vi.mock('electron-log', () => ({ default: { warn: vi.fn(), info: vi.fn() } }))
vi.mock('../../../src/main/infrastructure/updater/releaseDownload', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadRelease: electron.downloadRelease
}))

const DOWNLOAD = 'https://github.com/PetarStoev02/talyx-app/releases/download/v1.0.0/'
const RELEASE: FoundRelease = {
  summary: {
    version: '1.0.0',
    url: 'https://github.com/PetarStoev02/talyx-app/releases/tag/v1.0.0',
    publishedAt: '',
    highlights: [],
    changes: 0,
    downloadable: true
  },
  asset: { name: 'Talyx-arm64.dmg', url: `${DOWNLOAD}Talyx-arm64.dmg`, size: 10 },
  checksums: { name: 'SHA256SUMS', url: `${DOWNLOAD}SHA256SUMS`, size: 1 }
}
const SAVED = '/home/me/downloads/Talyx-arm64.dmg'

const invoke = (channel: string, ...args: unknown[]): unknown =>
  handlers.get(channel)!({ sender: {} }, ...args)

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('updater IPC', () => {
  let ipc: typeof import('../../../src/main/infrastructure/ipc/updater.ipc')
  const platform = process.platform

  beforeEach(async () => {
    handlers.clear()
    vi.clearAllMocks()
    vi.resetModules()
    electron.downloadRelease.mockResolvedValue(SAVED)
    ipc = await import('../../../src/main/infrastructure/ipc/updater.ipc')
    ipc.registerUpdaterIpc()
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: platform })
  })

  it('should report the current state and send every change to the windows', () => {
    expect(invoke('updater:status')).toEqual({ kind: 'none' })
    ipc.updates.found(RELEASE)
    const available = { kind: 'available', release: RELEASE.summary }
    expect(invoke('updater:status')).toEqual(available)
    expect(electron.send).toHaveBeenCalledWith('updater:state', available)
  })

  it('should download only the release main found, into the downloads folder', async () => {
    ipc.updates.found(RELEASE)
    await invoke('updater:download', { url: 'https://evil.example/x.dmg' }, '/tmp/x')
    await settle()

    expect(electron.downloadRelease).toHaveBeenCalledWith(
      RELEASE,
      expect.objectContaining({ dir: '/home/me/downloads' }),
      expect.any(Function),
      expect.any(AbortSignal)
    )
    expect(invoke('updater:status')).toEqual({ kind: 'ready', release: RELEASE.summary })
  })

  it('should refuse to open the installer until a download is verified', async () => {
    ipc.updates.found(RELEASE)
    await expect(invoke('updater:open-installer')).rejects.toThrow('No verified download')
    expect(electron.openPath).not.toHaveBeenCalled()
  })

  it('should open the verified file and never a path the page sends', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    ipc.updates.found(RELEASE)
    await invoke('updater:download')
    await settle()
    await invoke('updater:open-installer', '/Applications/Evil.app')

    expect(electron.openPath).toHaveBeenCalledWith(SAVED)
  })

  it('should fail when the system cannot open the installer', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    electron.openPath.mockResolvedValueOnce('No application is associated')
    ipc.updates.found(RELEASE)
    await invoke('updater:download')
    await settle()

    await expect(invoke('updater:open-installer')).rejects.toThrow('could not be opened')
  })

  it('should make the AppImage executable and show it in its folder on Linux', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    ipc.updates.found(RELEASE)
    await invoke('updater:download')
    await settle()
    await invoke('updater:open-installer')

    expect(electron.chmod).toHaveBeenCalledWith(SAVED, 0o755)
    expect(electron.showItemInFolder).toHaveBeenCalledWith(SAVED)
    expect(electron.openPath).not.toHaveBeenCalled()
  })

  it('should cancel a running download', async () => {
    electron.downloadRelease.mockImplementationOnce(
      (_found: unknown, _deps: unknown, _progress: unknown, signal: AbortSignal) =>
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
