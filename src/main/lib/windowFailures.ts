import { app, dialog, type BrowserWindow } from 'electron'
import log from 'electron-log'

// Chromium's code for a load cut short by another navigation: not a failure.
const LOAD_ABORTED = -3
/** How long the main window waits for ready-to-show before it is shown anyway. */
export const WINDOW_SHOW_TIMEOUT_MS = 8_000

/**
 * The main window must never sit blank: a page that fails to load, or a renderer that dies, is
 * logged and offered a reload.
 */
export function watchWindowFailures(win: BrowserWindow, reload: () => void): void {
  const offerReload = async (message: string, reason: string): Promise<void> => {
    if (win.isDestroyed()) return
    const { response } = await dialog.showMessageBox(win, {
      type: 'error',
      message,
      detail: `${reason}\n\nThe log has the details: ${log.transports.file.getFile().path}`,
      buttons: ['Reload', 'Quit'],
      defaultId: 0,
      cancelId: 1
    })
    if (response === 1) app.quit()
    else if (!win.isDestroyed()) reload()
  }
  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === LOAD_ABORTED) return
    log.error(`[Main] Window failed to load ${url} (${code} ${description})`)
    void offerReload('Talyx could not load its window.', `${description} (${code})`)
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('[Main] Renderer process gone', details)
    void offerReload('Talyx’s window stopped working.', details.reason)
  })
}

/** Swaps the splash for the main window once the window is ready to show. */
export function showWhenReady(win: BrowserWindow, splash: BrowserWindow): void {
  const swap = (): void => {
    if (!splash.isDestroyed()) splash.close()
    if (!win.isDestroyed()) win.show()
  }
  win.once('ready-to-show', swap)
  // ready-to-show can fail to fire; never leave the user with only the splash
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      log.warn('[Main] ready-to-show timeout; forcing window show')
      swap()
    }
  }, WINDOW_SHOW_TIMEOUT_MS)
}
