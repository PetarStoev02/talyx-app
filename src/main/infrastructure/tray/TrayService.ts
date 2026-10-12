import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron'
import { join } from 'path'

let tray: Tray | null = null

export function createTray(getWindow: () => BrowserWindow | null, onStopAgent: () => void): Tray {
  if (tray) return tray

  let icon: Electron.NativeImage
  try {
    // Template image auto-adapts to light/dark menu bar; macOS picks up @2x for Retina
    const templatePath = join(__dirname, '../../resources/trayTemplate.png')
    icon = nativeImage.createFromPath(templatePath)
    icon.setTemplateImage(true)
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('Talyx')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Talyx',
      click: () => {
        const win = getWindow()
        if (win) {
          win.show()
          win.focus()
        }
      }
    },
    {
      label: 'Stop agent',
      click: () => onStopAgent()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    const win = getWindow()
    if (win) {
      if (win.isVisible()) {
        win.focus()
      } else {
        win.show()
        win.focus()
      }
    }
  })

  return tray
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
