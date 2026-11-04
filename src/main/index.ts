import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import log from 'electron-log'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { optimizer, is } from './lib/electronUtils'
import { installWebContentsGuard } from './infrastructure/security/webContentsGuard'
import { registerSettingsIpc } from './infrastructure/ipc/settings.ipc'
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
  ipcMain.handle('theme:set-native', (_event, theme: unknown) => syncNativeTheme(theme))
  void devBridge?.start(Number(process.env['TALYX_BRIDGE_PORT'] ?? 5175))
}

/**
 * Keep the OS-rendered window material in the same appearance as the app theme;
 * otherwise a light app over a dark-mode system gets a dark frost behind it.
 */
function syncNativeTheme(theme: unknown): void {
  if (theme === 'light' || theme === 'dark' || theme === 'system') {
    nativeTheme.themeSource = theme
  }
}

function loadPage(win: BrowserWindow, page: 'index' | 'splash'): void {
  if (rendererUrl) {
    void win.loadURL(page === 'index' ? rendererUrl : `${rendererUrl}/splash.html`)
  } else {
    void win.loadFile(join(__dirname, `../renderer/${page}.html`))
  }
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
    trafficLightPosition: { x: 16, y: 16 },
    // macOS blurs the desktop behind the window; the renderer keeps a translucent background.
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
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

/** Tells the user about a newer release; Talyx is unsigned and installs nothing itself. */
function scheduleUpdateChecks(): void {
  if (is.dev) return
  const check = (): void => void checkForUpdate(mainWindow)
  setTimeout(check, STARTUP_UPDATE_CHECK_DELAY_MS)
  setInterval(check, UPDATE_CHECK_INTERVAL_MS)
}

app.whenReady().then(async () => {
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

  app.on('second-instance', () => {
    // On macOS the window can be closed while the app keeps running
    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = createWindow()
      mainWindow.once('ready-to-show', () => mainWindow?.show())
      return
    }
    mainWindow.show()
    mainWindow.focus()
  })
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  const splash = createSplashWindow()
  await waitForSplash(splash)
  splash.webContents.send('splash:version', app.getVersion())
  splash.webContents.send('splash:status', 'Starting...')
  await new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_VISIBLE_MS))

  registerIpc()
  syncNativeTheme(settingsStore.store.theme)
  showMainWindow(splash)
  scheduleUpdateChecks()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      mainWindow.once('ready-to-show', () => mainWindow?.show())
    }
  })
})

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})
