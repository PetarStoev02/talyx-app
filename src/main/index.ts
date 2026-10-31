import { app, BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { optimizer, is } from './lib/electronUtils'
import { installWebContentsGuard } from './infrastructure/security/webContentsGuard'
import icon from '../../resources/talyx-icon.png?asset'

import { getDatabase, closeDatabase } from './infrastructure/database'
import { registerSettingsIpc } from './infrastructure/ipc/settings.ipc'
import { SettingsStore } from './infrastructure/storage/SettingsStore'
import { createTray, destroyTray } from './infrastructure/tray/TrayService'
import { DevBridge } from './infrastructure/bridge/DevBridge'

const DEFAULT_BRIDGE_PORT = 5175

const rendererUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined

let mainWindow: BrowserWindow | null = null

// Browser dev bridge — lets a plain browser tab at localhost:5173 drive the app in dev
const devBridge = rendererUrl ? new DevBridge(Number(new URL(rendererUrl).port)) : null

function initializeServices(): void {
  getDatabase()
  const settingsStore = new SettingsStore(join(app.getPath('userData'), 'settings.json'))

  // The bridge tap goes first — it must see every registration
  devBridge?.installTap(ipcMain)
  registerSettingsIpc(settingsStore)
  void devBridge?.start(Number(process.env['TALYX_BRIDGE_PORT'] ?? DEFAULT_BRIDGE_PORT))
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#000000',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (rendererUrl) {
    window.loadURL(rendererUrl)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  window.once('ready-to-show', () => window.show())
  return window
}

app.whenReady().then(() => {
  if (!app.requestSingleInstanceLock()) {
    log.warn('[Main] Another instance holds the single-instance lock — quitting')
    app.quit()
    return
  }

  installWebContentsGuard(
    rendererUrl
      ? `${new URL(rendererUrl).origin}/`
      : `${pathToFileURL(join(__dirname, '../renderer')).href}/`
  )

  app.on('second-instance', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initializeServices()
  mainWindow = createWindow()
  createTray(() => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
  })

  // The app stays alive in the tray when the window closes.
  app.on('window-all-closed', () => {})

  app.on('will-quit', () => {
    destroyTray()
    closeDatabase()
  })
})
