import { ipcMain, BrowserWindow, shell, clipboard } from 'electron'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import type { SearchService } from '../../domain/search/services/SearchService'
import type { SearchIndexRepo } from '../../domain/search/repository/SearchIndexRepo'
import type { DeepScanService } from '../../domain/search/services/DeepScanService'

export function registerSearchIpc(
  searchService: SearchService,
  searchIndexRepo: SearchIndexRepo,
  deepScanService: DeepScanService
): void {
  ipcMain.handle(
    'search:query',
    async (
      _event,
      query: string,
      options?: {
        fileType?: string
        category?: string
        limit?: number
      }
    ) => {
      return searchService.search(query, options?.limit)
    }
  )

  ipcMain.handle('search:stats', () => {
    return searchIndexRepo.getStats()
  })

  // Deep scan — same indexer, with progress broadcast to the renderer
  ipcMain.handle(
    'search:deep-scan',
    async (_event, files: Array<{ path: string; name: string }>) => {
      return deepScanService.scan(files, (progress) => {
        const windows = BrowserWindow.getAllWindows()
        for (const win of windows) {
          win.webContents.send('search:scan-progress', progress)
        }
      })
    }
  )

  ipcMain.handle('quicksearch:action', async (_event, action: string, filePath: string) => {
    if (!existsSync(filePath)) {
      return { success: false, error: 'File not found' }
    }

    try {
      switch (action) {
        case 'open': {
          const error = await shell.openPath(filePath)
          if (error) return { success: false, error }
          return { success: true }
        }
        case 'reveal':
          shell.showItemInFolder(filePath)
          return { success: true }
        case 'copy':
          clipboard.writeText(filePath)
          return { success: true }
        case 'preview':
          return await getFilePreview(filePath)
        default:
          return { success: false, error: `Unknown action: ${action}` }
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Operation failed'
      }
    }
  })
}

async function getFilePreview(
  filePath: string
): Promise<{ success: boolean; preview?: { type: string; content: string }; error?: string }> {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
  const textExts = ['txt', 'md', 'json', 'csv', 'log', 'xml', 'yaml', 'yml', 'toml']
  const codeExts = [
    'js',
    'ts',
    'tsx',
    'jsx',
    'py',
    'go',
    'rs',
    'java',
    'c',
    'cpp',
    'h',
    'css',
    'html',
    'sh'
  ]

  if (imageExts.includes(ext)) {
    try {
      const buffer = await readFile(filePath)
      const mimeType =
        ext === 'svg'
          ? 'image/svg+xml'
          : ext === 'gif'
            ? 'image/gif'
            : ext === 'webp'
              ? 'image/webp'
              : ext === 'png'
                ? 'image/png'
                : 'image/jpeg'
      const base64 = buffer.toString('base64')
      return {
        success: true,
        preview: { type: 'image', content: `data:${mimeType};base64,${base64}` }
      }
    } catch {
      return { success: false, error: 'Cannot read image file' }
    }
  }

  if (textExts.includes(ext) || codeExts.includes(ext)) {
    try {
      const content = await readFile(filePath, 'utf-8')
      const lines = content.split('\n').slice(0, 50).join('\n')
      return {
        success: true,
        preview: { type: 'text', content: lines }
      }
    } catch {
      return { success: false, error: 'Cannot read file' }
    }
  }

  return {
    success: true,
    preview: { type: 'metadata', content: '' }
  }
}
