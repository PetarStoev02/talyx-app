import { autoUpdater as squirrel } from 'electron'
import log from 'electron-log'
import { autoUpdater, CancellationToken, type ProgressInfo } from 'electron-updater'
import type { UpdateFailure } from '../../../shared/updater'
import type { KeyObject } from 'node:crypto'
import { FEED_SIGNATURE_SUFFIX, feedVouchesFor, type OfferedUpdate } from './feedSignature'
import { RELEASE_ASSET_PREFIX, UPDATE_FEED_NAME } from './releaseCheck'
import { ReleaseDownloadError } from './updateState'

const CHECKSUM_MISMATCH = 'ERR_CHECKSUM_MISMATCH'

let configured = false

const NOT_FOUND = 404
const FEED_TIMEOUT_MS = 10_000
// A feed is a few hundred bytes; anything far larger is not one.
const MAX_FEED_BYTES = 64 * 1024

/** The download the user clicked: the version the update button showed them. */
export interface OfferedDownload {
  version: string
  onProgress: (received: number, total: number) => void
  signal: AbortSignal
}

/** Where the signed feed is read from, and the key its signature must verify with. */
export interface FeedSource {
  fetch: typeof fetch
  key: KeyObject
}

/**
 * Downloads the release with electron-updater (macOS, AppImage), which checks the file against the
 * sha512 in the release's latest-mac.yml or latest-linux.yml. Before anything downloads, that
 * feed must carry Talyx's signature (requireSignedFeed). On macOS it resolves only once
 * Squirrel.Mac has staged the update, which it does only when the new app's code signature
 * matches the running one. Resolves to the restart that installs it; quitting installs it too.
 */
export async function downloadSelfUpdate(
  { version, onProgress, signal }: OfferedDownload,
  source: FeedSource
): Promise<() => Promise<void>> {
  configure()
  const token = new CancellationToken()
  const cancel = (): void => token.cancel()
  const progress = (info: ProgressInfo): void => onProgress(info.transferred, info.total)
  signal.addEventListener('abort', cancel)
  autoUpdater.on('download-progress', progress)
  const staged = process.platform === 'darwin' ? whenSquirrelStaged() : null
  try {
    const check = await autoUpdater.checkForUpdates()
    if (!check?.isUpdateAvailable)
      throw new ReleaseDownloadError('other', 'The release has no update for this computer')
    // An older signed feed, replayed under a newer release, must not install another version
    // than the one shown.
    if (check.updateInfo.version !== version)
      throw new ReleaseDownloadError('other', 'The release is not the version that was offered')
    await requireSignedFeed(source, check.updateInfo, signal)
    await autoUpdater.downloadUpdate(token)
    await staged?.done
    return async () => autoUpdater.quitAndInstall()
  } catch (error) {
    throw error instanceof ReleaseDownloadError
      ? error
      : new ReleaseDownloadError(failureOf(error), 'The update did not download')
  } finally {
    staged?.dispose()
    signal.removeEventListener('abort', cancel)
    autoUpdater.off('download-progress', progress)
  }
}

/**
 * Refuses an update whose feed Talyx did not sign. electron-updater downloads exactly the files
 * of the update it offered and checks each against its sha512, so a signed feed of the same
 * version listing those files means they are the ones the release workflow built.
 */
async function requireSignedFeed(
  source: FeedSource,
  offered: OfferedUpdate,
  signal: AbortSignal
): Promise<void> {
  const feed = UPDATE_FEED_NAME[process.platform]
  if (!feed) throw new ReleaseDownloadError('signature', 'The update has no feed to check')
  // The version is the one the release check offered (downloadSelfUpdate), a plain x.y.z.
  const url = `${RELEASE_ASSET_PREFIX}v${offered.version}/${feed}`
  const read = async (from: string): Promise<Buffer> => {
    const response = await source.fetch(from, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(FEED_TIMEOUT_MS)])
    })
    // Not there means not signed; any other answer is GitHub failing, and says nothing of that.
    if (response.status === NOT_FOUND)
      throw new ReleaseDownloadError('signature', `${from} is missing`)
    if (!response.ok) throw new ReleaseDownloadError('other', `${from}: ${response.status}`)
    if (Number(response.headers.get('content-length') ?? 0) > MAX_FEED_BYTES)
      throw new ReleaseDownloadError('signature', `${from} is too large`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > MAX_FEED_BYTES)
      throw new ReleaseDownloadError('signature', `${from} is too large`)
    return bytes
  }
  const [bytes, signature] = await Promise.all([read(url), read(`${url}${FEED_SIGNATURE_SUFFIX}`)])
  if (!feedVouchesFor({ feed: bytes, signature: signature.toString('utf8') }, offered, source.key))
    throw new ReleaseDownloadError('signature', 'The update feed is not signed by Talyx')
}

// Talyx decides when to check and download; it restarts only on the user's click.
function configure(): void {
  if (configured) return
  configured = true
  autoUpdater.logger = log
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  // Failures also reject the download; without a listener the emitter would throw them.
  autoUpdater.on('error', (error) => log.warn('[Updater] Self-update failed:', error.message))
}

function failureOf(error: unknown): UpdateFailure {
  const code = (error as { code?: unknown } | null)?.code
  return code === CHECKSUM_MISMATCH ? 'checksum' : 'other'
}

/** Settles when Squirrel.Mac has the update staged, or refuses it (a signature mismatch). */
function whenSquirrelStaged(): { done: Promise<void>; dispose: () => void } {
  let dispose = (): void => undefined
  const done = new Promise<void>((resolve, reject) => {
    const staged = (): void => resolve()
    const failed = (error: Error): void => reject(error)
    squirrel.once('update-downloaded', staged)
    squirrel.once('error', failed)
    dispose = () => {
      squirrel.off('update-downloaded', staged)
      squirrel.off('error', failed)
    }
  })
  // Awaited only after the download; a refusal before then must not go unhandled.
  done.catch(() => undefined)
  return { done, dispose }
}
