import { app, BrowserWindow, ipcMain, shell, type WebContents } from 'electron'
import log from 'electron-log'
import * as fs from 'fs/promises'
import type { UpdateState } from '../../../shared/updater'
import { openInstaller } from '../updater/openInstaller'
import { downloadRelease } from '../updater/releaseDownload'
import { createUpdateStore } from '../updater/updateState'

/** The Talyx update for every window; the release checks in index.ts feed it. */
export const updates = createUpdateStore({
  download: (found, onProgress, signal) =>
    downloadRelease(found, { fetch, dir: app.getPath('downloads'), fs }, onProgress, signal),
  open: (file) => openInstaller(file, { platform: process.platform, shell, chmod: fs.chmod }),
  publish: (state) => {
    for (const win of BrowserWindow.getAllWindows()) emit(win.webContents, state)
  }
})

// No handler takes arguments: main downloads and opens only what it fetched and verified itself.
export function registerUpdaterIpc(): void {
  ipcMain.handle('updater:status', (): UpdateState => updates.current())
  ipcMain.handle('updater:download', (): void => void updates.startDownload())
  ipcMain.handle('updater:cancel', (): void => updates.cancel())
  ipcMain.handle('updater:open-installer', (): Promise<void> => updates.openInstaller())
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
