import { generateKeyPairSync, sign } from 'node:crypto'
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
import { ReleaseDownloadError } from '../../../src/main/infrastructure/updater/updateState'

const { updater, squirrel } = fakes
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

// The release's update feed as the release workflow publishes it, signed with a key made here.
const keys = generateKeyPairSync('ed25519')
const RELEASE = 'https://github.com/PetarStoev02/talyx-app/releases/download/v1.0.6/'
const HASH = 'c2hhNTEyLW9mLXRoZS1maWxl'
const FEED_TEXT = `version: 1.0.6\nfiles:\n  - url: Talyx-x86_64.AppImage\n    sha512: ${HASH}\n    size: 10\npath: Talyx-x86_64.AppImage\nsha512: ${HASH}\n`
const OFFERED = { version: '1.0.6', files: [{ sha512: HASH }] }

/** A release serving `files` by name; a name it lacks is a 404. */
function releaseWith(files: Record<string, string>): typeof fetch {
  return vi.fn(async (url: string) => {
    const body = files[url.replace(RELEASE, '')]
    return {
      ok: body !== undefined,
      status: body === undefined ? 404 : 200,
      arrayBuffer: async () => new TextEncoder().encode(body).buffer
    }
  }) as unknown as typeof fetch
}

function signedRelease(feed = 'latest-linux.yml', text = FEED_TEXT): typeof fetch {
  const signature = sign(null, Buffer.from(text), keys.privateKey).toString('base64')
  return releaseWith({ [feed]: text, [`${feed}.sig`]: `${signature}\n` })
}

const download = (
  fetchFn: typeof fetch = signedRelease(),
  signal = new AbortController().signal,
  progress = vi.fn()
): Promise<() => Promise<void>> =>
  downloadSelfUpdate(progress, signal, { fetch: fetchFn, key: keys.publicKey })

function failureOf(error: unknown): string | null {
  return error instanceof ReleaseDownloadError ? error.reason : null
}

describe('downloadSelfUpdate', () => {
  const platform = process.platform

  beforeEach(() => {
    vi.clearAllMocks()
    fakes.tokens.length = 0
    Object.defineProperty(process, 'platform', { value: 'linux' })
    updater.checkForUpdates.mockResolvedValue({ isUpdateAvailable: true, updateInfo: OFFERED })
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
    const restart = await download(signedRelease(), new AbortController().signal, progress)

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
    const error = await download().catch((e) => e)
    expect(failureOf(error)).toBe('other')
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
  })

  it.each([
    ['ERR_CHECKSUM_MISMATCH', 'checksum'],
    ['ERR_UPDATER_CHANNEL_FILE_NOT_FOUND', 'other']
  ])('should report a %s download error as %s', async (code, reason) => {
    updater.downloadUpdate.mockRejectedValueOnce(Object.assign(new Error('x'), { code }))
    const error = await download().catch((e) => e)
    expect(failureOf(error)).toBe(reason)
  })

  it('should cancel the download when the signal aborts', async () => {
    const controller = new AbortController()
    updater.downloadUpdate.mockImplementationOnce(() => new Promise(() => undefined))
    void download(signedRelease(), controller.signal)
    await settle()
    controller.abort()
    expect(fakes.tokens[0].cancelled).toBe(true)
  })

  describe('a feed Talyx did not sign', () => {
    const other = generateKeyPairSync('ed25519')
    const signedBy = (key: typeof keys.privateKey, text = FEED_TEXT): string =>
      sign(null, Buffer.from(text), key).toString('base64')
    const feed = 'latest-linux.yml'

    it.each([
      ['has no signature', releaseWith({ [feed]: FEED_TEXT })],
      ['is missing', releaseWith({})],
      [
        'is signed with another key',
        releaseWith({ [feed]: FEED_TEXT, [`${feed}.sig`]: signedBy(other.privateKey) })
      ],
      [
        'was changed after signing',
        releaseWith({
          [feed]: FEED_TEXT.replaceAll(HASH, 'b3RoZXI='),
          [`${feed}.sig`]: signedBy(keys.privateKey)
        })
      ],
      ['has a signature that is not one', releaseWith({ [feed]: FEED_TEXT, [`${feed}.sig`]: 'x' })],
      [
        'is signed but lists other files than the update offered',
        signedRelease(feed, FEED_TEXT.replaceAll(HASH, 'b3RoZXI='))
      ],
      [
        'is signed but for another version',
        signedRelease(feed, FEED_TEXT.replace('1.0.6', '1.0.5'))
      ]
    ])('should download nothing when the feed %s', async (_name, fetchFn) => {
      const error = await download(fetchFn).catch((e) => e)
      expect(failureOf(error)).toBe('signature')
      expect(updater.downloadUpdate).not.toHaveBeenCalled()
    })

    it.each(['../../../evil/repo', '1.0.6/../../x', ''])(
      'should not build a URL from the version %j',
      async (version) => {
        updater.checkForUpdates.mockResolvedValueOnce({
          isUpdateAvailable: true,
          updateInfo: { ...OFFERED, version }
        })
        const fetchFn = signedRelease()
        expect(failureOf(await download(fetchFn).catch((e) => e))).toBe('signature')
        expect(fetchFn).not.toHaveBeenCalled()
      }
    )

    it('should refuse an update that names no files', async () => {
      updater.checkForUpdates.mockResolvedValueOnce({
        isUpdateAvailable: true,
        updateInfo: { version: '1.0.6', files: [] }
      })
      expect(failureOf(await download().catch((e) => e))).toBe('signature')
    })
  })

  describe('on macOS', () => {
    beforeEach(() => Object.defineProperty(process, 'platform', { value: 'darwin' }))

    it('should be ready only once Squirrel has staged the signed update', async () => {
      let ready = false
      const running = download(signedRelease('latest-mac.yml')).then(() => {
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
      const running = download(signedRelease('latest-mac.yml')).catch((e) => e)
      await settle()
      squirrel.emit('error', new Error('Code signature did not match'))
      expect(failureOf(await running)).toBe('other')
      expect(squirrel.listenerCount('error')).toBe(0)
    })

    it('should not leave a Squirrel refusal unhandled when the download fails first', async () => {
      updater.downloadUpdate.mockRejectedValueOnce(new Error('offline'))
      const error = await download(signedRelease('latest-mac.yml')).catch((e) => e)
      expect(failureOf(error)).toBe('other')
      expect(squirrel.listenerCount('error')).toBe(0)
    })
  })
})
