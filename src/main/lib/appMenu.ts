import { Menu, type MenuItemConstructorOptions } from 'electron'

/** A dev run's View menu: reload and dev tools. */
export const DEV_VIEW_ITEMS: MenuItemConstructorOptions[] = [
  { role: 'reload' },
  { role: 'toggleDevTools' },
  { type: 'separator' }
]

/**
 * The app's menu. Electron's default one keeps View > Toggle Developer Tools, and a console
 * pasted into on someone's say-so could read every saved API key through the engine, so the
 * packaged app gets no dev tools; a dev run passes DEV_VIEW_ITEMS as `viewExtras`.
 * Kept: the app and window menus, editing shortcuts (copy and paste need them on macOS) and zoom.
 * "Enter License Key..." is the quiet way into modules: nothing else in the app mentions them
 * until a key is active.
 */
export function setAppMenu(
  platform: NodeJS.Platform,
  onEnterLicense: () => void,
  viewExtras: MenuItemConstructorOptions[] = []
): void {
  const enterLicense: MenuItemConstructorOptions = {
    label: 'Enter License Key…',
    click: onEnterLicense
  }
  const template: MenuItemConstructorOptions[] = [
    platform === 'darwin'
      ? {
          role: 'appMenu',
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            enterLicense,
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }
      : { role: 'fileMenu', submenu: [enterLicense, { type: 'separator' }, { role: 'quit' }] },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        ...viewExtras,
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
