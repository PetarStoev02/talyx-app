import {
  copyFile,
  rename,
  mkdir,
  access,
  readdir,
  rmdir,
  unlink,
  realpath,
  lstat
} from 'fs/promises'
import { join, extname, basename, dirname, resolve, sep } from 'path'
import { randomUUID } from 'crypto'
import log from 'electron-log'
import type { SortHistoryRepo } from '../repository/SortHistoryRepo'
import type { SortOperation } from '../model/SortOperation'
import type { SortBatch } from '../model/SortBatch'
import type { SortMode } from '../model/SortMode'
import type { DeepScanService } from '../../search/services/DeepScanService'
import type { EnhancedClassificationResult } from '../../classification/model/ClassificationResult'

/** An extension a file manager will act on: a dot, then a few letters or digits. */
const PLAUSIBLE_EXTENSION = /^\.[A-Za-z0-9]{1,6}$/

function isFinderMetadata(name: string): boolean {
  return name === '.DS_Store' || name.startsWith('._')
}

export interface ClassifiedFile {
  path: string
  name: string
  size: number
  classification: EnhancedClassificationResult
}

export interface SortProgress {
  current: number
  total: number
  fileName: string
}

export class SortExecutor {
  constructor(
    private historyRepo: SortHistoryRepo,
    private searchIndexer?: DeepScanService
  ) {}

  async executeBatch(
    files: ClassifiedFile[],
    outputDir: string,
    mode: SortMode,
    onProgress?: (progress: SortProgress) => void,
    approvedRenames?: Record<string, string>
  ): Promise<SortBatch> {
    const batchId = randomUUID()
    const operations: SortOperation[] = []
    const startedAt = new Date()
    // SQLite's UTC "YYYY-MM-DD HH:MM:SS"; SortHistoryRepo reads it back as UTC.
    const now = startedAt.toISOString().replace('T', ' ').slice(0, 19)

    const resolvedOutputDir = resolve(outputDir)
    await mkdir(resolvedOutputDir, { recursive: true })
    const realOutputDir = await realpath(resolvedOutputDir)

    let skippedSymlinks = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      // copyFile and rename would carry a symlink's target (a key, a credentials file)
      // into the output; a link is never the owner's file to sort.
      if ((await lstat(file.path)).isSymbolicLink()) {
        skippedSymlinks++
        continue
      }
      const destDir = this.buildDestDir(outputDir, file.classification)

      const originalName = file.name
      const finalName = this.withOriginalExtension(
        approvedRenames?.[file.path] ?? file.name,
        file.name
      )
      const destPath = join(destDir, finalName)

      // Security: ensure destination stays within output directory
      const resolvedDest = resolve(destPath)
      if (!resolvedDest.startsWith(resolvedOutputDir + sep)) {
        throw new Error(
          `Path traversal blocked: destination "${resolvedDest}" escapes output directory`
        )
      }

      await mkdir(destDir, { recursive: true })
      // resolve() above cannot see symlinks; a folder already in the output may be
      // one, and rename/copyFile would follow it out of the output folder.
      const realDestDir = await realpath(destDir)
      if (realDestDir !== realOutputDir && !realDestDir.startsWith(realOutputDir + sep)) {
        throw new Error('Path traversal blocked: destination escapes output directory')
      }
      const finalPath = await this.resolveConflict(destPath)

      if (mode === 'copy') {
        await copyFile(file.path, finalPath)
      } else {
        await rename(file.path, finalPath)
      }

      const op: SortOperation = {
        batchId,
        sourcePath: file.path,
        destPath: finalPath,
        operationType: mode,
        category: file.classification.category,
        subcategory: file.classification.subcategory,
        fileName: finalName,
        fileSize: file.size,
        originalName,
        newName: finalName !== originalName ? finalName : null,
        createdAt: now
      }

      this.historyRepo.recordOperation(op)
      operations.push(op)

      onProgress?.({ current: i + 1, total: files.length, fileName: finalName })
    }

    if (skippedSymlinks > 0) log.warn(`Skipped ${skippedSymlinks} symlink(s) while sorting`)

    if (mode === 'move') await this.removeEmptiedSourceFolders(files.map((f) => dirname(f.path)))

    this.indexSortedFiles(operations)

    return {
      batchId,
      operations,
      undoneAt: null,
      timestamp: startedAt,
      totalFiles: operations.length
    }
  }

  /**
   * Repair a suggested name that ends in something no app can open. Models are
   * told to answer `descriptive-name_YYYYMMDD.ext` and regularly answer
   * `notes.md_20240101` instead. A name that already ends in a believable
   * extension is left exactly as it is — it may be the owner's own typing in
   * the rename panel, and `photo.heic` to `photo.jpg` is their call to make.
   */
  private withOriginalExtension(suggested: string, originalName: string): string {
    if (PLAUSIBLE_EXTENSION.test(extname(suggested))) return suggested

    const ext = extname(originalName)
    if (!ext) return suggested

    const at = suggested.toLowerCase().lastIndexOf(ext.toLowerCase())
    const stem = at >= 0 ? suggested.slice(0, at) + suggested.slice(at + ext.length) : suggested
    const trimmed = stem.replace(/[-_.\s]+$/, '')
    return (trimmed || basename(originalName, ext)) + ext
  }

  /**
   * Seed the search index with what was just sorted. Search finds nothing until
   * the owner runs a whole-computer scan, and the files Talyx itself moved are
   * the ones most worth finding. Detached on purpose — the sort is already done.
   */
  private indexSortedFiles(operations: SortOperation[]): void {
    if (!this.searchIndexer) return
    // destPath, never fileName: a name taken by another file was suffixed on the way to disk.
    const files = operations.map((op) => ({ path: op.destPath, name: basename(op.destPath) }))
    this.searchIndexer
      .scan(files)
      .catch((err) => log.warn('Could not index the files that were just sorted:', err))
  }

  private buildDestDir(outputDir: string, classification: EnhancedClassificationResult): string {
    if (classification.semanticPath && classification.semanticPath.length > 0) {
      return join(outputDir, ...classification.semanticPath)
    }
    const parts = [outputDir, classification.category]
    if (classification.subcategory) {
      parts.push(classification.subcategory)
    }
    return join(...parts)
  }

  /**
   * Removes the source folders this batch emptied, bottom-up. A folder goes only while
   * it lies strictly inside another folder the batch also took files from, so the
   * folder being sorted, anything above it, and the output are never touched.
   */
  private async removeEmptiedSourceFolders(sourceDirs: string[]): Promise<void> {
    // ponytail: a folder is only removed when the batch also took files from a folder above
    // it; pass the scanned folder in if emptied top-level subfolders should go too.
    const dirs = [...new Set(sourceDirs.map((d) => resolve(d)))]
    const isInsideAnother = (dir: string): boolean =>
      dirs.some((other) => dir.startsWith(other + sep))
    for (const dir of dirs) {
      let current = dir
      while (isInsideAnother(current) && (await this.removeIfEmpty(current))) {
        current = dirname(current)
      }
    }
  }

  /** Empty means nothing but Finder's own metadata. Returns whether the folder was removed. */
  private async removeIfEmpty(dir: string): Promise<boolean> {
    try {
      const entries = await readdir(dir)
      if (entries.some((name) => !isFinderMetadata(name))) return false
      for (const name of entries) await unlink(join(dir, name))
      await rmdir(dir)
      return true
    } catch (err) {
      // The sort itself already succeeded; a folder left behind is not worth failing it.
      log.warn('Could not remove an emptied source folder:', (err as NodeJS.ErrnoException).code)
      return false
    }
  }

  private async resolveConflict(destPath: string): Promise<string> {
    let candidate = destPath
    let counter = 1
    while (await this.fileExists(candidate)) {
      const ext = extname(destPath)
      const base = destPath.slice(0, destPath.length - ext.length)
      candidate = `${base}_${counter}${ext}`
      counter++
    }
    return candidate
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath)
      return true
    } catch {
      return false
    }
  }
}
