import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'
import log from 'electron-log'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { optimizer, is } from './lib/electronUtils'
import { installWebContentsGuard } from './infrastructure/security/webContentsGuard'
import { registerSettingsIpc } from './infrastructure/ipc/settings.ipc'
import { registerLogIpc } from './infrastructure/ipc/log.ipc'
import { closeEngineSockets, registerEngineIpc } from './infrastructure/ipc/engine.ipc'
import { checkForUpdate } from './infrastructure/updater/releaseCheck'
import { settingsStore } from './infrastructure/storage/SettingsStore'
import { DevBridge } from './infrastructure/bridge/DevBridge'
import icon from '../../resources/talyx-icon.png?asset'

/** Long enough for the window to settle; short enough to land in the first minute. */
const STARTUP_UPDATE_CHECK_DELAY_MS = 15_000
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60_000
const SPLASH_LOAD_TIMEOUT_MS = 5_000
const SPLASH_MIN_VISIBLE_MS = 500
const WINDOW_SHOW_TIMEOUT_MS = 8_000

const isMac = process.platform === 'darwin'
const rendererUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined

let mainWindow: BrowserWindow | null = null

// Browser dev bridge: lets a plain browser tab at localhost:5173 drive the app in dev
const devBridge = rendererUrl ? new DevBridge(Number(new URL(rendererUrl).port)) : null

function registerIpc(): void {
  // Bridge tap first: it must see every registration
  devBridge?.installTap(ipcMain)
  registerSettingsIpc()
  registerEngineIpc()
  registerLogIpc()
  ipcMain.handle('theme:set-native', (_event, theme: unknown) => syncNativeTheme(theme))
  devBridge
    ?.start(Number(process.env['TALYX_BRIDGE_PORT'] ?? 5175))
    .catch((error: unknown) => log.error('[DevBridge] Could not start', error))
}

/** Keep native chrome (menus, dialogs, scrollbars) in the same appearance as the app theme. */
function syncNativeTheme(theme: unknown): void {
  if (theme === 'light' || theme === 'dark' || theme === 'system') {
    nativeTheme.themeSource = theme
  }
}

/** The theme's ground (--background in theme.css), so a resize never flashes another colour. */
function groundColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#0a0a0c' : '#ffffff'
}

// A failed load is reported by did-fail-load (see watchWindowFailures); the promise only logs.
function loadPage(win: BrowserWindow, page: 'index' | 'splash'): void {
  const loading = rendererUrl
    ? win.loadURL(page === 'index' ? rendererUrl : `${rendererUrl}/splash.html`)
    : win.loadFile(join(__dirname, `../renderer/${page}.html`))
  loading.catch((error: unknown) => log.warn(`[Main] ${page} page did not load`, error))
}

// Chromium's code for a load cut short by another navigation: not a failure.
const LOAD_ABORTED = -3

/**
 * The main window must never sit blank: a page that fails to load, or a renderer that dies, is
 * logged and offered a reload.
 */
function watchWindowFailures(win: BrowserWindow): void {
  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === LOAD_ABORTED) return
    log.error(`[Main] Window failed to load ${url} (${code} ${description})`)
    void offerReload(win, 'Talyx could not load its window.', `${description} (${code})`)
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('[Main] Renderer process gone', details)
    void offerReload(win, 'Talyx’s window stopped working.', details.reason)
  })
}

async function offerReload(win: BrowserWindow, message: string, reason: string): Promise<void> {
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
  else if (!win.isDestroyed()) loadPage(win, 'index')
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: 'hiddenInset',
    // Centered on the 56px title row (h-14 in AppShell and PageHeader).
    trafficLightPosition: { x: 16, y: 22 },
    backgroundColor: groundColor(),
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  watchWindowFailures(win)
  loadPage(win, 'index')
  return win
}

function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 320,
    height: 380,
    frame: false,
    resizable: false,
    backgroundColor: '#0a0a0a',
    alwaysOnTop: true,
    center: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/splash.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  loadPage(splash, 'splash')
  return splash
}

/** A failed or stalled splash load must never block startup (headless runs, corrupt assets). */
function waitForSplash(splash: BrowserWindow): Promise<void> {
  return new Promise((resolve) => {
    const proceed = (): void => {
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(() => {
      log.warn('[Main] Splash did not load in time; continuing without it')
      proceed()
    }, SPLASH_LOAD_TIMEOUT_MS)
    splash.webContents.once('did-finish-load', () => {
      splash.show()
      proceed()
    })
    splash.webContents.once('did-fail-load', (_e, code, desc) => {
      log.warn(`[Main] Splash failed to load (${code} ${desc}); continuing`)
      proceed()
    })
  })
}

function showMainWindow(splash: BrowserWindow): void {
  const win = createWindow()
  mainWindow = win
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

/** On macOS the window can be closed while the app keeps running; reopen it then. */
function bringMainWindowForward(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    const win = createWindow()
    mainWindow = win
    win.once('ready-to-show', () => win.show())
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

/** Tells the user about a newer release; Talyx is unsigned and installs nothing itself. */
function scheduleUpdateChecks(): void {
  if (is.dev) return
  const check = (): void => void checkForUpdate(mainWindow)
  setTimeout(check, STARTUP_UPDATE_CHECK_DELAY_MS)
  setInterval(check, UPDATE_CHECK_INTERVAL_MS)
}

// Logged rather than left to Electron's default dialog, which would stop at the first one.
process.on('uncaughtException', (error) => log.error('[Main] Uncaught exception', error))
process.on('unhandledRejection', (reason) => log.error('[Main] Unhandled rejection', reason))

app
  .whenReady()
  .then(async () => {
    if (!app.requestSingleInstanceLock()) {
      log.warn('[Main] Another instance holds the single-instance lock; quitting')
      app.quit()
      return
    }

    installWebContentsGuard(
      rendererUrl
        ? `${new URL(rendererUrl).origin}/`
        : `${pathToFileURL(join(__dirname, '../renderer')).href}/`
    )

    app.on('browser-window-created', (_, window) =>
      optimizer.watchWindowShortcuts(window, { zoom: true })
    )

    const splash = createSplashWindow()
    await waitForSplash(splash)
    // The splash can be closed by then (a crash, a click); startup goes on without it.
    if (!splash.isDestroyed()) {
      splash.webContents.send('splash:version', app.getVersion())
      splash.webContents.send('splash:status', 'Starting...')
    }
    await new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_VISIBLE_MS))

    registerIpc()
    // A theme switch (in Talyx or, on System, in the OS) repaints the window's ground too.
    nativeTheme.on('updated', () => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setBackgroundColor(groundColor())
    })
    syncNativeTheme(settingsStore.store.theme)
    showMainWindow(splash)
    scheduleUpdateChecks()

    // Registered only now: a launch during the splash must not race showMainWindow
    app.on('second-instance', bringMainWindowForward)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) bringMainWindowForward()
    })
  })
  .catch((error: unknown) => {
    // Nothing is on screen yet to show this, so it gets a native box before Talyx quits.
    log.error('[Main] Startup failed', error)
    dialog.showErrorBox(
      'Talyx could not start',
      `${error instanceof Error ? error.message : String(error)}\n\nThe log has the details: ${log.transports.file.getFile().path}`
    )
    app.quit()
  })

// Only Talyx's sockets close; the engine gateway outlives the app and is never stopped here.
app.on('before-quit', closeEngineSockets)

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})
