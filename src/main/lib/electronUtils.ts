import { app, BrowserWindow } from 'electron'

// Lives in our own source so Electron 39's ESM loader can intercept the 'electron' import
// (it only intercepts bundled code, not node_modules).

export const is = {
  get dev(): boolean {
    return !app.isPackaged
  }
}

export const optimizer = {
  watchWindowShortcuts(
    window: BrowserWindow,
    shortcutOptions?: { escToCloseWindow?: boolean; zoom?: boolean }
  ): void {
    if (!window) return
    const { webContents } = window
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {}
    webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown') {
        if (!is.dev) {
          if (input.code === 'KeyR' && (input.control || input.meta)) event.preventDefault()
          if (
            input.code === 'KeyI' &&
            ((input.alt && input.meta) || (input.control && input.shift))
          ) {
            event.preventDefault()
          }
        } else {
          if (input.code === 'F12') {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools()
            } else {
              webContents.openDevTools({ mode: 'undocked' })
              console.log('Open dev tool...')
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === 'Escape' && input.key !== 'Process') {
            window.close()
            event.preventDefault()
          }
        }
        if (!zoom) {
          if (input.code === 'Minus' && (input.control || input.meta)) event.preventDefault()
          if (input.code === 'Equal' && input.shift && (input.control || input.meta))
            event.preventDefault()
        }
      }
    })
  }
}
