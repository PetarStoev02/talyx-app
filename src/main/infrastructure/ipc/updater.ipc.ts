import { app, BrowserWindow, ipcMain, shell, type WebContents } from 'electron'
import log from 'electron-log'
import * as fs from 'fs/promises'
import type { UpdateState } from '../../../shared/updater'
import { openInstaller } from '../updater/openInstaller'
import { downloadRelease } from '../updater/releaseDownload'
import { downloadSelfUpdate } from '../updater/selfUpdate'
import { createUpdateStore, type Install } from '../updater/updateState'

/** The Talyx update for every window; the release checks in index.ts feed it. */
export const updates = createUpdateStore({
  download: async (found, onProgress, signal): Promise<Install> => {
    if (found.summary.automatic) return downloadSelfUpdate(onProgress, signal)
    const dir = app.getPath('downloads')
    const file = await downloadRelease(found, { fetch, dir, fs }, onProgress, signal)
    return () => openInstaller(file, { platform: process.platform, shell, chmod: fs.chmod })
  },
  publish: (state) => {
    for (const win of BrowserWindow.getAllWindows()) emit(win.webContents, state)
  }
})

// No handler takes arguments: main downloads and installs only what it fetched and verified itself.
export function registerUpdaterIpc(): void {
  ipcMain.handle('updater:status', (): UpdateState => updates.current())
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
