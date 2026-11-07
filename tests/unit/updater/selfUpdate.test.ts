import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fakes = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter: Emitter } = require('events') as typeof import('events')
  class Token {
    cancelled = false
    cancel(): void {
      this.cancelled = true
    }
  }
  const updater = Object.assign(new Emitter(), {
    logger: null as unknown,
    autoDownload: true,
    autoInstallOnAppQuit: false,
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn()
  })
  return { updater, squirrel: new Emitter(), Token, tokens: [] as Token[] }
})

vi.mock('electron', () => ({ autoUpdater: fakes.squirrel }))
vi.mock('electron-log', () => ({ default: { warn: vi.fn(), info: vi.fn() } }))
vi.mock('electron-updater', () => ({
  autoUpdater: fakes.updater,
  CancellationToken: class extends fakes.Token {
    constructor() {
      super()
      fakes.tokens.push(this)
    }
  }
}))

import { downloadSelfUpdate } from '../../../src/main/infrastructure/updater/selfUpdate'
import { ReleaseDownloadError } from '../../../src/main/infrastructure/updater/releaseDownload'

const { updater, squirrel } = fakes
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function failureOf(error: unknown): string | null {
  return error instanceof ReleaseDownloadError ? error.reason : null
}

describe('downloadSelfUpdate', () => {
  const platform = process.platform

  beforeEach(() => {
    vi.clearAllMocks()
    fakes.tokens.length = 0
    Object.defineProperty(process, 'platform', { value: 'linux' })
    updater.checkForUpdates.mockResolvedValue({ isUpdateAvailable: true })
    updater.downloadUpdate.mockImplementation(async () => {
      updater.emit('download-progress', { transferred: 5, total: 10 })
      return ['/cache/Talyx-x86_64.AppImage']
    })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: platform })
  })

  it('should download with progress and leave the restart to the caller', async () => {
    const progress = vi.fn()
    const restart = await downloadSelfUpdate(progress, new AbortController().signal)

    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(true)
    expect(progress).toHaveBeenCalledWith(5, 10)
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
    expect(updater.listenerCount('download-progress')).toBe(0)

    await restart()
    expect(updater.quitAndInstall).toHaveBeenCalledOnce()
  })

  it('should fail when the feed has no newer version for this computer', async () => {
    updater.checkForUpdates.mockResolvedValueOnce({ isUpdateAvailable: false })
    const error = await downloadSelfUpdate(vi.fn(), new AbortController().signal).catch((e) => e)
    expect(failureOf(error)).toBe('other')
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
  })

  it.each([
    ['ERR_CHECKSUM_MISMATCH', 'checksum'],
    ['ERR_UPDATER_CHANNEL_FILE_NOT_FOUND', 'other']
  ])('should report a %s download error as %s', async (code, reason) => {
    updater.downloadUpdate.mockRejectedValueOnce(Object.assign(new Error('x'), { code }))
    const error = await downloadSelfUpdate(vi.fn(), new AbortController().signal).catch((e) => e)
    expect(failureOf(error)).toBe(reason)
  })

  it('should cancel the download when the signal aborts', async () => {
    const controller = new AbortController()
    updater.downloadUpdate.mockImplementationOnce(() => new Promise(() => undefined))
    void downloadSelfUpdate(vi.fn(), controller.signal)
    await settle()
    controller.abort()
    expect(fakes.tokens[0].cancelled).toBe(true)
  })

  describe('on macOS', () => {
    beforeEach(() => Object.defineProperty(process, 'platform', { value: 'darwin' }))

    it('should be ready only once Squirrel has staged the signed update', async () => {
      let ready = false
      const running = downloadSelfUpdate(vi.fn(), new AbortController().signal).then(() => {
        ready = true
      })
      await settle()
      expect(ready).toBe(false)

      squirrel.emit('update-downloaded')
      await running
      expect(ready).toBe(true)
      expect(squirrel.listenerCount('update-downloaded')).toBe(0)
      expect(squirrel.listenerCount('error')).toBe(0)
    })

    it('should fail when Squirrel refuses the update, as it does for a different signature', async () => {
      const running = downloadSelfUpdate(vi.fn(), new AbortController().signal).catch((e) => e)
      await settle()
      squirrel.emit('error', new Error('Code signature did not match'))
      expect(failureOf(await running)).toBe('other')
      expect(squirrel.listenerCount('error')).toBe(0)
    })

    it('should not leave a Squirrel refusal unhandled when the download fails first', async () => {
      updater.downloadUpdate.mockRejectedValueOnce(new Error('offline'))
      const error = await downloadSelfUpdate(vi.fn(), new AbortController().signal).catch((e) => e)
      expect(failureOf(error)).toBe('other')
      expect(squirrel.listenerCount('error')).toBe(0)
    })
  })
})
