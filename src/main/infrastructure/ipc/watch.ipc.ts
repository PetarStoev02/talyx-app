import { ipcMain } from 'electron'
import { z } from 'zod/v4'
import type { WatchFolderRepo } from '../../domain/watching/repository/WatchFolderRepo'
import type { WatchService } from '../../domain/watching/services/WatchService'
import { validateInput, WatchAddParamsSchema, WatchToggleParamsSchema } from './validation'

export function registerWatchIpc(repo: WatchFolderRepo, watchService: WatchService): void {
  ipcMain.handle('watch:list', async () => {
    return repo.getAll()
  })

  ipcMain.handle('watch:add', async (_event, rawParams: unknown) => {
    const params = validateInput(WatchAddParamsSchema, rawParams)
    const folder = repo.add({
      path: params.path,
      enabled: true,
      outputPath: params.outputPath,
      sortMode: params.sortMode
    })
    await watchService.startWatching(folder)
    return folder
  })

  ipcMain.handle('watch:remove', async (_event, folderId: unknown) => {
    const id = validateInput(z.number().int().positive(), folderId)
    await watchService.stopWatching(id)
    repo.remove(id)
  })

  ipcMain.handle('watch:set-mode', async (_event, rawParams: unknown) => {
    const params = validateInput(
      z.object({ id: z.number().int().positive(), sortMode: z.enum(['copy', 'move']) }),
      rawParams
    )
    repo.setSortMode(params.id, params.sortMode)
    // Restart watcher so it picks up the new mode
    const folder = repo.getById(params.id)
    if (folder && folder.enabled) {
      await watchService.stopWatching(params.id)
      await watchService.startWatching(folder)
    }
    return folder
  })

  ipcMain.handle('watch:toggle', async (_event, rawParams: unknown) => {
    const params = validateInput(WatchToggleParamsSchema, rawParams)
    repo.setEnabled(params.id, params.enabled)
    if (params.enabled) {
      const folder = repo.getById(params.id)
      if (folder) await watchService.startWatching(folder)
    } else {
      await watchService.stopWatching(params.id)
    }
  })
}
