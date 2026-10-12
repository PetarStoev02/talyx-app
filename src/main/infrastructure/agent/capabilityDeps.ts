import { shell } from 'electron'
import { execFile } from 'child_process'
import { readdir, realpath, statfs } from 'fs/promises'
import { existsSync, statSync } from 'fs'
import { basename, join } from 'path'
import type { Capability } from '../../domain/instruction/model/Capability'
import { fileCapabilities } from '../../domain/instruction/capabilities/files'
import { systemCapabilities } from '../../domain/instruction/capabilities/system'
import { devCapabilities } from '../../domain/instruction/capabilities/dev'
import { desktopCapabilities } from '../../domain/instruction/capabilities/desktop'
import { everydayCapabilities } from '../../domain/instruction/capabilities/everyday'
import { briefingCapabilities } from '../../domain/instruction/capabilities/briefing'
import type { BriefingService } from '../../domain/briefing/services/BriefingService'
import { everydayDeps } from './everydayDeps'
import { mailCapabilities } from '../../domain/instruction/capabilities/mail'
import { messageCapabilities } from '../../domain/instruction/capabilities/messages'
import { messagesDeps } from './messagesDeps'
import { undoCapabilities } from '../../domain/instruction/capabilities/undo'
import { recallCapabilities } from '../../domain/instruction/capabilities/recall'
import { triageCapabilities } from '../../domain/instruction/capabilities/triage'
import { focusCapabilities } from '../../domain/instruction/capabilities/focus'
import { screenCapabilities, type ScreenDeps } from '../../domain/instruction/capabilities/screen'
import type { CapabilityRegistry } from '../../domain/instruction/model/CapabilityRegistry'
import { UnexecutableCapabilityError } from '../../domain/instruction/model/errors'
import { desktopDeps } from './desktopDeps'
import { applyFilePayload } from './applyFilePayload'
import { runShell } from './runShell'
import { FolderNotFoundError } from '../../domain/instruction/model/errors'
import { scanForSort } from '../../domain/shared/scanForSort'
import { DuplicateDetector } from '../../domain/sorting/services/DuplicateDetector'
import type { ClassificationPipeline } from '../../domain/classification/services/ClassificationPipeline'
import type { SearchIndexRepo } from '../../domain/search/repository/SearchIndexRepo'
import type { ActionLogRepo } from './ActionLogRepo'
import type { TextExtractor } from '../../domain/classification/services/TextExtractor'
import type { SortHistoryRepo } from '../../domain/sorting/repository/SortHistoryRepo'
import type { RecallService } from '../../domain/search/services/RecallService'
import type { TriageService } from '../../domain/briefing/services/TriageService'

export function buildCapabilities(deps: {
  /** The developer abilities only exist for owners who have a code folder. */
  hasProjects: boolean
  pipeline: ClassificationPipeline
  searchIndexRepo: SearchIndexRepo
  actionLog: ActionLogRepo
  textExtractor: TextExtractor
  historyRepo: SortHistoryRepo
  recallService: RecallService
  triageService: TriageService
  /** The registry these capabilities end up in; read lazily so undo can route to any of them. */
  registry: () => CapabilityRegistry
  /** The same briefing the scheduler pushes, so asking for one and being given one agree. */
  briefing: BriefingService
  screen: ScreenDeps
  /** Focus quiets notices until a meeting ends; Settings and ⌘⇧Esc share the same field. */
  pausedUntil: () => string | null
  setPausedUntil: (iso: string | null) => void
}): Capability[] {
  const duplicateDetector = new DuplicateDetector()
  const desktop = desktopDeps()
  const everyday = everydayDeps(deps.textExtractor, desktop.recentFiles)

  return [
    ...fileCapabilities({
      async scanFolder(folderPath) {
        assertFolderExists(folderPath)
        const scan = await scanForSort(folderPath)
        return scan.files.map((f) => ({ name: f.name, path: f.path, size: f.size }))
      },
      async classify(files) {
        const classified = await deps.pipeline.classifyFiles(files)
        return classified.map((f) => ({
          name: f.name,
          path: f.path,
          size: f.size,
          category: f.classification.category as string,
          subcategory: f.classification.subcategory
        }))
      },
      async findDuplicateGroups(folderPath) {
        assertFolderExists(folderPath)
        const scan = await scanForSort(folderPath)
        const groups = await duplicateDetector.detect(
          scan.files.map((f) => ({ path: f.path, size: f.size }))
        )
        return groups.map((g) => g.paths)
      },
      async searchFiles(query, limit) {
        return deps.searchIndexRepo.searchKeyword(query, limit).map((r) => ({
          path: r.filePath,
          name: basename(r.filePath),
          snippet: r.snippet
        }))
      },
      apply: (payload) => applyFilePayload(payload, (path) => shell.trashItem(path)),
      recordSortOperation: (op) => deps.historyRepo.recordOperation(op),
      convertImage: desktop.convertImage
    }),
    ...systemCapabilities({
      async freeSpace(path) {
        const s = await statfs(path)
        return { freeBytes: s.bavail * s.bsize, totalBytes: s.blocks * s.bsize }
      },
      setDarkMode: desktop.setDarkMode,
      setWifi: desktop.setWifi,
      setMuted: desktop.setMuted,
      volume: desktop.volume,
      setVolume: desktop.setVolume
    }),
    ...(deps.hasProjects
      ? devCapabilities({
          async listRepos(root) {
            const entries = await readdir(root, { withFileTypes: true })
            const repos: string[] = []
            for (const e of entries) {
              if (e.isDirectory() && existsSync(join(root, e.name, '.git'))) repos.push(e.name)
            }
            return repos.sort()
          },
          realpath: (p) => realpath(p),
          run: runShell
        })
      : []),
    ...desktopCapabilities({
      async openApp(name, path) {
        await execFileAsync('open', path ? ['-a', name, path] : ['-a', name])
      },
      openExternal: (url) => shell.openExternal(url),
      async findByName(query, limit) {
        const out = await execFileAsync('mdfind', ['-name', query])
        return out.split('\n').filter(Boolean).slice(0, limit)
      },
      recentFiles: desktop.recentFiles,
      latestScreenshot: desktop.latestScreenshot,
      music: desktop.music,
      now: () => new Date()
    }),
    ...everydayCapabilities(everyday),
    ...briefingCapabilities({ compose: () => deps.briefing.compose() }),
    ...mailCapabilities({ unreadMessages: desktop.unreadMessages }),
    ...messageCapabilities(messagesDeps()),
    ...recallCapabilities({
      recall: (query, limit) => deps.recallService.recall(query, { limit })
    }),
    ...triageCapabilities({
      triage: () => deps.triageService.triage()
    }),
    ...screenCapabilities(deps.screen),
    ...focusCapabilities({
      now: () => new Date(),
      calendarEvents: everyday.calendarEvents,
      recall: async (query, limit) => deps.recallService.recall(query, { limit }).hits,
      pausedUntil: deps.pausedUntil,
      setPausedUntil: deps.setPausedUntil
    }),
    ...undoCapabilities({
      latestUndoable: async () => deps.actionLog.latestUndoable(),
      revert: (tool, op, ctx) => capabilityNamed(tool).revert!(op, ctx),
      async redo(tool, op, ctx) {
        await capabilityNamed(tool).execute!(op, ctx)
      }
    })
  ]

  function capabilityNamed(tool: string): Capability {
    const capability = deps.registry().get(tool)
    if (!capability?.revert || !capability.execute) throw new UnexecutableCapabilityError(tool)
    return capability
  }
}

function execFileAsync(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout)
    )
  })
}

function assertFolderExists(folderPath: string): void {
  if (!existsSync(folderPath) || !statSync(folderPath).isDirectory()) {
    throw new FolderNotFoundError(folderPath)
  }
}
