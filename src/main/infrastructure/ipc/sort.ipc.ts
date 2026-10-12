import { ipcMain, shell } from 'electron'
import log from 'electron-log'
import type { ClassificationPipeline } from '../../domain/classification/services/ClassificationPipeline'
import type { SortExecutor, ClassifiedFile } from '../../domain/sorting/services/SortExecutor'
import type { UndoService } from '../../domain/sorting/services/UndoService'
import type { SortHistoryRepo } from '../../domain/sorting/repository/SortHistoryRepo'
import type { FileEntry } from '../../domain/shared/FileEntry'
import { RenameEngine } from '../../domain/sorting/services/RenameEngine'
import { DuplicateDetector } from '../../domain/sorting/services/DuplicateDetector'
import type { SettingsStore } from '../storage/SettingsStore'
import type { TextExtractor } from '../../domain/classification/services/TextExtractor'
import type { ClassificationCacheRepo } from '../../domain/classification/repository/ClassificationCacheRepo'
import { SmartLocalSorter } from '../../domain/classification/services/Sorter'
import type { ApiKeyStore } from '../agent/ApiKeyStore'
import { findOwnersClaude, resolveSorter } from './resolveSorter'
import { countEscalatable, escalateAndMerge, readCandidates } from './escalateAndMerge'
import { fileFingerprint } from '../../domain/shared/fileFingerprint'
import { coerceToTaxonomy, isValidTaxonomyPath } from '../../domain/classification/model/Category'
import { z } from 'zod/v4'
import {
  validateInput,
  FileEntrySchema,
  SortExecuteParamsSchema,
  SortHistoryParamsSchema
} from './validation'

export interface SortIpcDeps {
  pipeline: ClassificationPipeline
  executor: SortExecutor
  undoService: UndoService
  historyRepo: SortHistoryRepo
  settingsStore?: SettingsStore
  textExtractor?: TextExtractor
  classificationCacheRepo?: ClassificationCacheRepo
  /** The same key the assistant uses; only read when the owner sorts with Claude. */
  apiKeyStore?: ApiKeyStore
}

export function registerSortIpc(deps: SortIpcDeps): void {
  const { pipeline, executor, undoService, historyRepo, settingsStore, classificationCacheRepo } =
    deps

  /** Absent, locked or undecryptable: all three mean "no Claude", never a thrown sort. */
  const readApiKey = (): string | null => {
    try {
      return deps.apiKeyStore?.has() ? deps.apiKeyStore.read() : null
    } catch (err) {
      log.warn('[sort:preview] Could not read the stored API key:', err)
      return null
    }
  }

  ipcMain.handle('sort:preview', async (_event, rawFiles: unknown) => {
    const files = validateInput(FileEntrySchema.array(), rawFiles) as FileEntry[]

    // Apply language settings
    const appLanguage = settingsStore?.store?.appLanguage ?? 'en'

    // Who reads these files is the owner's choice, made once per sort. The
    // fallback is Smart Local, which sends nothing anywhere.
    const settings = settingsStore?.store
    const source = settings?.sorterSource ?? 'smart-local'
    let sorter = resolveSorter({
      source,
      claude:
        settings && source === 'claude'
          ? findOwnersClaude({ settings, apiKey: readApiKey() })
          : null
    })
    if (sorter.id !== source) {
      log.warn(`[sort:preview] "${source}" is not available — sorting with "${sorter.id}"`)
    }

    const sender = _event.sender
    const total = files.length
    let completed = 0
    const startTime = Date.now()
    // Stage 1: Extension-based classification (instant, always runs as fallback)
    const classified: ClassifiedFile[] = []
    for (const file of files) {
      const result = await pipeline.classify(file.path)
      completed++
      sender.send('sort:classify-progress', {
        completed,
        total,
        currentFile: file.name,
        phase: 'classifying'
      })
      classified.push({
        path: file.path,
        name: file.name,
        size: file.size,
        classification: result
      })
    }

    // Stage 1b: apply cached classifications — content-addressed, so a
    // renamed or moved file is still recognized. Hits skip AI entirely.
    const fingerprints = new Map<ClassifiedFile, string>()
    const cachedIndices = new Set<number>()
    if (classificationCacheRepo) {
      const FP_CONCURRENCY = 16
      for (let i = 0; i < classified.length; i += FP_CONCURRENCY) {
        const chunk = classified.slice(i, i + FP_CONCURRENCY)
        await Promise.all(
          chunk.map(async (file, j) => {
            const idx = i + j
            try {
              const fp = await fileFingerprint(file.path)
              fingerprints.set(file, fp)
              // Per sorter: one model's answer is never served as another's.
              const hit = classificationCacheRepo.get(fp, sorter.engineVersion)
              if (hit) {
                cachedIndices.add(idx)
                // Rows written before taxonomy validation can hold invented paths
                const path = coerceToTaxonomy(hit.category, hit.subcategory)
                file.classification.category = path.category
                file.classification.subcategory = path.subcategory
                file.classification.confidence = hit.confidence
                file.classification.semanticPath = path.subcategory
                  ? [path.category, path.subcategory]
                  : [path.category]
                if (hit.suggestedName) file.classification.suggestedName = hit.suggestedName
              }
            } catch {
              // Unreadable file — no fingerprint, no caching for it
            }
          })
        )
      }
      if (cachedIndices.size > 0) {
        log.info(`[sort:preview] Cache hits: ${cachedIndices.size}/${classified.length} files`)
      }
    }

    // Stage 2: escalation — of the files the cache could not answer, Claude
    // sees the whole batch (names, metadata, and extracted text when available).
    const anyMisses = cachedIndices.size < classified.length

    const missed = classified.filter((_, idx) => !cachedIndices.has(idx))
    // Reported on the done event as how many files would need reading. Computed
    // the same way on every path, from names alone, so Smart Local answers it
    // without opening a file.
    const escalated = countEscalatable(missed)

    if (sorter.id !== 'smart-local' && anyMisses) {
      // A sorter that blows up must cost the owner a better sort, never the
      // preview itself — Smart Local's classifications are already in hand.
      try {
        const candidates = await readCandidates(missed, deps.textExtractor, (completed, file) => {
          sender.send('sort:classify-progress', {
            completed,
            total,
            currentFile: file.name,
            phase: 'extracting'
          })
        })
        const outcome = await escalateAndMerge(candidates, sorter, appLanguage, (progress) => {
          sender.send('sort:classify-progress', {
            completed: progress.completed,
            total: progress.total,
            currentFile: progress.currentFile,
            phase: progress.phase
          })
        })
        log.info(
          `[sort:preview] Sorter "${sorter.id}": sent ${outcome.sent.length}/${candidates.length} ` +
            `files, ${escalated} needed reading; ${outcome.applied.length} refiled`
        )

        // Remember the accepted answers by content — future sorts skip the model
        for (const { file } of outcome.applied) {
          const fp = fingerprints.get(file)
          if (!fp || !classificationCacheRepo) continue
          const c = file.classification
          classificationCacheRepo.setFromAi(
            fp,
            {
              category: c.category,
              subcategory: c.subcategory,
              suggestedName: c.suggestedName ?? null,
              confidence: c.confidence
            },
            sorter.engineVersion
          )
        }
      } catch (err) {
        log.warn('[sort:preview] AI classification failed, using extension fallback:', err)
        sorter = new SmartLocalSorter()
      }
    } else {
      log.info(
        `[sort:preview] Sorter "${sorter.id}": nothing read, nothing sent; ` +
          `${escalated} files needed reading`
      )
    }

    // Final pass: RenameEngine catches files the AI didn't rename
    const renameEngine = new RenameEngine()
    let renamedByFallback = 0
    for (const file of classified) {
      if (file.classification.suggestedName) continue
      const c = file.classification
      const suggestedName = renameEngine.suggest(file.name, {
        semanticPath: c.semanticPath ?? [c.category],
        suggestedName: null,
        entities: c.entities ?? {
          dates: [],
          names: [],
          amounts: [],
          organizations: [],
          locations: []
        },
        confidence: c.confidence
      })
      if (suggestedName) {
        file.classification.suggestedName = suggestedName
        renamedByFallback++
      }
    }
    if (renamedByFallback > 0) {
      log.info(`RenameEngine fallback: suggested ${renamedByFallback} additional renames`)
    }

    const elapsedMs = Date.now() - startTime
    const elapsedSec = (elapsedMs / 1000).toFixed(1)
    log.info(`Classification complete: ${classified.length} files in ${elapsedSec}s`)
    sender.send('sort:classify-progress', {
      completed: total,
      total,
      currentFile: '',
      phase: 'done',
      elapsedMs,
      escalated,
      // Which sorter actually read these files. Differs from the owner's choice
      // whenever their Claude could not be reached, and the page says so rather
      // than leaving them to notice a worse sort.
      sorter: sorter.id
    })

    return classified
  })

  ipcMain.handle('sort:execute', async (_event, rawParams: unknown) => {
    const params = validateInput(SortExecuteParamsSchema, rawParams)
    const sender = _event.sender
    const batch = await executor.executeBatch(
      params.files as ClassifiedFile[],
      params.outputDir,
      params.mode,
      (progress) => {
        sender.send('sort:progress', progress)
      },
      params.approvedRenames
    )
    return batch
  })

  ipcMain.handle('sort:undo', async (_event, batchId: unknown) => {
    const id = validateInput(z.string().uuid(), batchId)
    return undoService.undoBatch(id)
  })

  ipcMain.handle('sort:history', async (_event, rawParams: unknown) => {
    const params = validateInput(SortHistoryParamsSchema, rawParams)
    return historyRepo.getHistory(params.limit, params.offset)
  })

  ipcMain.handle('sort:delete-batch', async (_event, batchId: unknown) => {
    const id = validateInput(z.string().uuid(), batchId)
    historyRepo.deleteBatch(id)
  })

  ipcMain.handle('sort:clear-history', async () => {
    historyRepo.clearAll()
  })

  const duplicateDetector = new DuplicateDetector()

  ipcMain.handle('sort:detect-duplicates', async (_event, rawFiles: unknown) => {
    const files = validateInput(
      z.array(z.object({ path: z.string(), size: z.number().nonnegative() })),
      rawFiles
    )
    return duplicateDetector.detect(files)
  })

  ipcMain.handle('sort:trash-files', async (_event, rawPaths: unknown) => {
    const paths = validateInput(z.array(z.string()), rawPaths)
    let trashed = 0
    for (const filePath of paths) {
      try {
        await shell.trashItem(filePath)
        trashed++
      } catch (err) {
        log.warn(`Failed to trash "${filePath}":`, err)
      }
    }
    return { trashed, total: paths.length }
  })

  ipcMain.handle('sort:detect-empty-folders', async (_event, rawPath: unknown) => {
    const folderPath = validateInput(z.string(), rawPath)
    const { readdir: readdirAsync } = await import('fs/promises')
    const { join: joinPath } = await import('path')
    const { detectFolderKind } = await import('../../domain/shared/scanForSort')

    const emptyFolders: string[] = []

    async function walk(dir: string): Promise<void> {
      try {
        const entries = await readdirAsync(dir, { withFileTypes: true })
        const realEntries = entries.filter(
          (e) => e.name !== '.DS_Store' && !e.name.startsWith('._')
        )
        const subDirs = realEntries.filter((e) => e.isDirectory())
        const files = realEntries.filter((e) => !e.isDirectory())

        for (const sub of subDirs) {
          await walk(joinPath(dir, sub.name))
        }

        if (files.length === 0 && subDirs.length === 0) {
          emptyFolders.push(dir)
        }
      } catch {
        // Directory can't be read — skip
      }
    }

    // Only scan subdirectories, not the root itself. Projects and app
    // folders are sealed — an "empty" dir inside a project may be load-bearing
    try {
      const rootEntries = await readdirAsync(folderPath, { withFileTypes: true })
      for (const entry of rootEntries) {
        if (entry.isDirectory()) {
          const subPath = joinPath(folderPath, entry.name)
          if ((await detectFolderKind(subPath)) !== 'folder') continue
          await walk(subPath)
        }
      }
    } catch {
      // Root can't be read
    }

    return emptyFolders
  })

  // Inline preview correction — pin a user's category/subcategory fix under the
  // file's content fingerprint so it survives renames, moves, and re-sorts
  ipcMain.handle('classification:correct', async (_event, rawParams: unknown) => {
    const params = validateInput(
      z
        .object({
          filePath: z.string(),
          category: z.string(),
          subcategory: z.string().nullable()
        })
        .refine((p) => isValidTaxonomyPath(p.category, p.subcategory), {
          message: 'category_subcategory_not_in_taxonomy'
        }),
      rawParams
    )
    if (!classificationCacheRepo) return { success: false }
    try {
      const fp = await fileFingerprint(params.filePath)
      classificationCacheRepo.setCorrection(fp, params.category, params.subcategory)
      return { success: true }
    } catch (err) {
      log.warn('[classification:correct] Could not fingerprint file:', err)
      return { success: false }
    }
  })
}
