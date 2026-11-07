import { autoUpdater as squirrel } from 'electron'
import log from 'electron-log'
import { autoUpdater, CancellationToken, type ProgressInfo } from 'electron-updater'
import type { UpdateFailure } from '../../../shared/updater'
import { ReleaseDownloadError } from './releaseDownload'

const CHECKSUM_MISMATCH = 'ERR_CHECKSUM_MISMATCH'

let configured = false

/**
 * Downloads the release with electron-updater (macOS, AppImage), which checks the file against the
 * sha512 in the release's latest-mac.yml or latest-linux.yml. On macOS it resolves only once
 * Squirrel.Mac has staged the update, which it does only when the new app's code signature
 * matches the running one. Resolves to the restart that installs it; quitting installs it too.
 */
export async function downloadSelfUpdate(
  onProgress: (received: number, total: number) => void,
  signal: AbortSignal
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
