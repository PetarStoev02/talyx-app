import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron'
import log from 'electron-log'
import {
  MODULE_SCHEME,
  type ActivationRequest,
  type AvailableModule,
  type ModulesState
} from '../../../shared/modules'
import { createModuleHost } from '../modules/moduleHost'
import { ModuleIdSchema, PUBLISHED_KEYS } from '../modules/signing'
import { settingsStore } from '../storage/SettingsStore'
import { engineHttp } from './engine.ipc'
import {
  EngineHttpRequestSchema,
  LicenseKeyInputSchema,
  ModuleActionSchema,
  validateInput
} from './validation'

/** The modules for every window; index.ts starts it and serves its files. */
export const modules = createModuleHost({
  root: app.getPath('userData'),
  keys: PUBLISHED_KEYS,
  fetch,
  licenseKey: {
    read: () => settingsStore.store.licenseKey,
    write: (licenseKey) => settingsStore.set({ licenseKey })
  },
  // Module code is signed, but its requests take the same checks as the page's.
  engineHttp: (request) => engineHttp(validateInput(EngineHttpRequestSchema, request)),
  pickFolder: async (title) => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const options = { title, properties: ['openDirectory' as const] }
    const picked = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    return picked.canceled ? null : (picked.filePaths[0] ?? null)
  },
  log,
  publish: (state) => broadcast('modules:state', state),
  now: Date.now
})

let pendingActivation: ActivationRequest | null = null

/**
 * The menu item or an activation link asks for the dialog. The page takes the request when it
 * hears the ping or when it mounts, so a link that started Talyx is not lost before the page loads.
 */
export function requestActivation(request: ActivationRequest): void {
  pendingActivation = request
  broadcast('modules:activation-requested')
}

export function registerModulesIpc(): void {
  ipcMain.handle('modules:state', (): ModulesState => modules.state())
  ipcMain.handle('modules:take-activation', (): ActivationRequest | null => {
    const request = pendingActivation
    pendingActivation = null
    return request
  })
  ipcMain.handle(
    'modules:activate',
    (_event, rawKey: unknown): Promise<ModulesState> =>
      modules.activate(validateInput(LicenseKeyInputSchema, rawKey))
  )
  ipcMain.handle('modules:deactivate', (): Promise<ModulesState> => modules.deactivate())
  ipcMain.handle('modules:available', (): Promise<AvailableModule[]> => modules.available())
  ipcMain.handle(
    'modules:install',
    (_event, rawId: unknown): Promise<ModulesState> =>
      modules.install(validateInput(ModuleIdSchema, rawId))
  )
  ipcMain.handle(
    'modules:uninstall',
    (_event, rawId: unknown): Promise<ModulesState> =>
      modules.uninstall(validateInput(ModuleIdSchema, rawId))
  )
  ipcMain.handle(
    'modules:invoke',
    (_event, rawId: unknown, rawAction: unknown, input: unknown): Promise<unknown> =>
      modules.invoke(
        validateInput(ModuleIdSchema, rawId),
        validateInput(ModuleActionSchema, rawAction),
        input
      )
  )
}

/**
 * Serves a running module's page files (talyx-module://<id>/renderer.js) from the verified bundle
 * in memory, never from disk, so what the page runs is what passed the signature check.
 */
export function serveModuleFiles(): void {
  protocol.handle(MODULE_SCHEME, (request) => {
    const url = new URL(request.url)
    const file = modules.file(url.hostname, url.pathname.slice(1))
    if (!file) return new Response(null, { status: 404 })
    // The page imports it as a module script from another origin (app:// or the dev server).
    // Never cached: the files come from memory anyway, and a cached stylesheet would outlive a
    // reinstall of the same version.
    return new Response(file.body, {
      headers: {
        'Content-Type': file.type,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    })
  })
}

function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.webContents.isDestroyed()) win.webContents.send(channel, ...args)
  }
}
