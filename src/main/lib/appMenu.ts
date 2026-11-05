import { Menu, type MenuItemConstructorOptions } from 'electron'

/**
 * The packaged app's menu: Electron's default one keeps View > Toggle Developer Tools, and a
 * console pasted into on someone's say-so could read every saved API key through the engine.
 * Kept: the app and window menus, editing shortcuts (copy and paste need them on macOS) and zoom.
 */
export function setProductionMenu(platform: NodeJS.Platform): void {
  const template: MenuItemConstructorOptions[] = [
    platform === 'darwin' ? { role: 'appMenu' } : { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
