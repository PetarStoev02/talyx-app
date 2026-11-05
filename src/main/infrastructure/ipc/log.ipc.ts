import { ipcMain } from 'electron'
import log from 'electron-log'
import { RendererErrorSchema, validateInput } from './validation'

/** Renderer failures land in the same log file as main's (electron-log's default location). */
export function registerLogIpc(): void {
  ipcMain.handle('log:error', (_event, raw: unknown) => {
    const { scope, message } = validateInput(RendererErrorSchema, raw)
    log.error(`[Renderer:${scope}]`, message)
  })
}
