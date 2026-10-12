import { watch } from 'chokidar'
import { basename } from 'path'
import { lstat, stat } from 'fs/promises'
import type { FSWatcher } from 'chokidar'
import type { WatchFolder } from '../model/WatchFolder'
import type { WatchFolderRepo } from '../repository/WatchFolderRepo'
import type { ClassificationPipeline } from '../../classification/services/ClassificationPipeline'
import type { SortExecutor, ClassifiedFile } from '../../sorting/services/SortExecutor'

export interface WatchEvent {
  type: 'file-sorted' | 'error'
  folderPath: string
  filePath: string
  category?: string
  error?: string
}

export class WatchService {
  private watchers = new Map<number, FSWatcher>()

  constructor(
    private repo: WatchFolderRepo,
    private pipeline: ClassificationPipeline,
    private executor: SortExecutor,
    private onEvent?: (event: WatchEvent) => void
  ) {}

  async startAll(): Promise<void> {
    const folders = this.repo.getEnabled()
    for (const folder of folders) {
      await this.startWatching(folder)
    }
  }

  async startWatching(folder: WatchFolder): Promise<void> {
    if (!folder.id || !folder.outputPath) return
    if (this.watchers.has(folder.id)) return

    const watcher = watch(folder.path, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 },
      depth: 0, // Only watch top-level files
      followSymlinks: false
    })

    watcher.on('add', async (filePath: string) => {
      // Skip hidden/invisible files (dotfiles, Chrome temp files, macOS metadata)
      const fileName = basename(filePath)
      if (fileName.startsWith('.') || fileName.startsWith('~')) return

      try {
        // A link dropped here can point at any file the user can read; never open its target.
        if ((await lstat(filePath)).isSymbolicLink()) return

        const result = await this.pipeline.classify(filePath)
        const fileStat = await stat(filePath)
        const classified: ClassifiedFile = {
          path: filePath,
          name: basename(filePath),
          size: fileStat.size,
          classification: result
        }

        await this.executor.executeBatch([classified], folder.outputPath!, folder.sortMode)

        this.onEvent?.({
          type: 'file-sorted',
          folderPath: folder.path,
          filePath,
          category: result.category
        })
      } catch (e) {
        this.onEvent?.({
          type: 'error',
          folderPath: folder.path,
          filePath,
          error: (e as Error).message
        })
      }
    })

    this.watchers.set(folder.id, watcher)
  }

  async stopWatching(folderId: number): Promise<void> {
    const watcher = this.watchers.get(folderId)
    if (watcher) {
      await watcher.close()
      this.watchers.delete(folderId)
    }
  }

  async stopAll(): Promise<void> {
    for (const [id] of this.watchers) {
      await this.stopWatching(id)
    }
  }

  isWatching(folderId: number): boolean {
    return this.watchers.has(folderId)
  }
}
