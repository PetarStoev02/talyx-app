import { join } from 'node:path'
import { app, ipcMain } from 'electron'
import { keepFile } from '../storage/keptFiles'
import { KeptFileSchema, validateInput } from './validation'

const KEPT_FOLDER = 'attachments'

/** Copies of dropped or pasted files with no path of their own, for a bot to open by path. */
export function registerFilesIpc(): void {
  ipcMain.handle(
    'files:keep',
    (_event, rawFile: unknown): Promise<string> =>
      keepFile(join(app.getPath('userData'), KEPT_FOLDER), validateInput(KeptFileSchema, rawFile))
  )
}
