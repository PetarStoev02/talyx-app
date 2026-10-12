import { ipcMain, dialog, app, shell } from 'electron'
import { stat } from 'fs/promises'
import { extname, resolve, normalize } from 'path'
import type { FileEntry } from '../../domain/shared/FileEntry'
import { walkDir, isHiddenOrTemp } from '../../domain/shared/walkDir'
import { scanForSort, type SortScanResult } from '../../domain/shared/scanForSort'

function isAbsolutePath(p: string): boolean {
  const normalized = normalize(p)
  return normalized === resolve(normalized)
}

export function registerFolderIpc(): void {
  ipcMain.handle('folder:select', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.filePaths[0] ?? null
  })

  ipcMain.handle('folder:home', () => {
    return app.getPath('home')
  })

  ipcMain.handle('folder:show-in-explorer', (_event, filePath: unknown) => {
    if (typeof filePath === 'string') {
      shell.showItemInFolder(filePath)
    }
  })

  // Opens with the default app (a folder opens in Finder itself)
  ipcMain.handle('folder:open', async (_event, filePath: unknown) => {
    if (typeof filePath === 'string') {
      await shell.openPath(filePath)
    }
  })

  ipcMain.handle('folder:scan', async (_event, folderPath: unknown): Promise<FileEntry[]> => {
    if (typeof folderPath !== 'string' || !isAbsolutePath(folderPath)) {
      throw new Error('folder:scan requires an absolute path')
    }
    return walkDir(folderPath)
  })

  // Sort-scoped scan: loose root files only — subfolders are sealed units,
  // never opened, so projects and app folders can't be scattered by a sort
  ipcMain.handle(
    'folder:scan-for-sort',
    async (_event, folderPath: unknown, rawOptions?: unknown): Promise<SortScanResult> => {
      if (typeof folderPath !== 'string' || !isAbsolutePath(folderPath)) {
        throw new Error('folder:scan-for-sort requires an absolute path')
      }
      const includeSubfolders =
        typeof rawOptions === 'object' &&
        rawOptions !== null &&
        (rawOptions as Record<string, unknown>).includeSubfolders === true
      return scanForSort(folderPath, { includeSubfolders })
    }
  )

  // Dropped paths arrive undifferentiated — only the filesystem knows which are
  // directories, so the split happens here rather than from a renderer guess
  ipcMain.handle(
    'folder:classify-paths',
    async (_event, paths: unknown): Promise<{ folders: string[]; files: string[] }> => {
      if (!Array.isArray(paths)) throw new Error('folder:classify-paths requires an array')
      const folders: string[] = []
      const files: string[] = []
      for (const p of paths) {
        if (typeof p !== 'string' || !isAbsolutePath(p)) continue
        try {
          const entry = await stat(p)
          if (entry.isDirectory()) folders.push(p)
          else if (entry.isFile()) files.push(p)
        } catch {
          // skip inaccessible paths
        }
      }
      return { folders, files }
    }
  )

  ipcMain.handle('folder:scan-files', async (_event, filePaths: unknown): Promise<FileEntry[]> => {
    if (!Array.isArray(filePaths)) throw new Error('folder:scan-files requires an array')
    const files: FileEntry[] = []
    for (const p of filePaths) {
      if (typeof p !== 'string' || !isAbsolutePath(p)) continue
      try {
        const fileStat = await stat(p)
        if (!fileStat.isFile()) continue
        const name = p.split(/[\\/]/).pop() ?? p
        if (isHiddenOrTemp(name)) continue
        files.push({
          name,
          path: p,
          extension: extname(name).toLowerCase(),
          size: fileStat.size,
          modifiedAt: fileStat.mtime
        })
      } catch {
        // skip inaccessible files
      }
    }
    return files
  })
}
