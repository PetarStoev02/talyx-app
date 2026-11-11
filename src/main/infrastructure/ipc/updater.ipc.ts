import { app, BrowserWindow, ipcMain, type WebContents } from 'electron'
import log from 'electron-log'
import type { UpdateCheck, UpdateState } from '../../../shared/updater'
import { UPDATE_FEED_KEY } from '../updater/feedSignature'
import { fetchLatestRelease } from '../updater/releaseCheck'
import { createReleaseChecks } from '../updater/releaseChecks'
import { downloadSelfUpdate } from '../updater/selfUpdate'
import { createUpdateStore, type Install } from '../updater/updateState'

/** The Talyx update for every window; the release checks feed it. */
export const updates = createUpdateStore({
  download: (version, onProgress, signal): Promise<Install> =>
    downloadSelfUpdate({ version, onProgress, signal }, { fetch, key: UPDATE_FEED_KEY }),
  publish: (state) => {
    for (const win of BrowserWindow.getAllWindows()) emit(win.webContents, state)
  }
})

/** Release checks: index.ts runs them on a schedule, the Settings button on a click. */
export const releaseChecks = createReleaseChecks({
  fetchLatest: () => fetchLatestRelease(fetch, app.getVersion()),
  found: (release) => updates.found(release),
  now: Date.now
})

// No handler takes arguments: main downloads and installs only what it fetched and verified itself.
export function registerUpdaterIpc(): void {
  ipcMain.handle('updater:status', (): UpdateState => updates.current())
  ipcMain.handle('updater:check', (): Promise<UpdateCheck> => releaseChecks.check())
  ipcMain.handle('updater:download', (): void => void updates.startDownload())
  ipcMain.handle('updater:cancel', (): void => updates.cancel())
  ipcMain.handle('updater:install', (): Promise<void> => updates.install())
}

// Never throws: it runs inside download progress, where a throw would fail the download.
function emit(contents: WebContents, state: UpdateState): void {
  if (contents.isDestroyed()) return
  try {
    contents.send('updater:state', state)
  } catch (error) {
    log.warn('[Updater] Could not send to the page:', error)
  }
}
