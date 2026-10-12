// Typed wrappers around window.api exposed by preload
import type { UndoReply } from '@shared/lib/undoToast'

export interface FileEntry {
  name: string
  path: string
  extension: string
  size: number
  modifiedAt: string
}

export interface ExtractedEntities {
  dates: string[]
  names: string[]
  amounts: string[]
  organizations: string[]
  locations: string[]
}

export interface ClassifiedFile {
  path: string
  name: string
  size: number
  classification: {
    category: string
    subcategory: string | null
    confidence: number
    metadata: Record<string, unknown>
    semanticPath?: string[]
    suggestedName?: string | null
    entities?: ExtractedEntities
  }
}

export interface SortBatch {
  batchId: string
  operations: SortOperation[]
  timestamp: string
  totalFiles: number
  undoneAt: string | null
}

export interface SortOperation {
  id?: number
  batchId: string
  sourcePath: string
  destPath: string
  operationType: 'copy' | 'move'
  category: string | null
  subcategory: string | null
  fileName: string
  fileSize: number | null
  originalName?: string | null
  newName?: string | null
  createdAt: string
}

export interface SortProgress {
  current: number
  total: number
  fileName: string
}

export interface WatchFolder {
  id: number
  path: string
  enabled: boolean
  outputPath: string | null
  sortMode: 'copy' | 'move'
  createdAt: string
}

export interface WatchEvent {
  type: 'file-sorted' | 'error'
  folderPath: string
  filePath: string
  category?: string
  error?: string
}

export interface SealedFolder {
  name: string
  path: string
  kind: 'project' | 'app' | 'folder'
  fileCount: number
}

export interface SortScanResult {
  files: FileEntry[]
  sealedFolders: SealedFolder[]
  /** Files inside plain subfolders that a deeper scan would pick up. */
  nestedFileCount: number
}

export const folderApi = {
  select: (): Promise<string | null> => window.api.selectFolder() as Promise<string | null>,
  home: (): Promise<string> => window.api.getHomeDir() as Promise<string>,
  showInExplorer: (filePath: string): Promise<void> =>
    window.api.showInExplorer(filePath) as Promise<void>,
  open: (filePath: string): Promise<void> => window.api.openPath(filePath) as Promise<void>,
  scan: (path: string): Promise<FileEntry[]> => window.api.scanFolder(path) as Promise<FileEntry[]>,
  scanForSort: (path: string, options?: { includeSubfolders?: boolean }): Promise<SortScanResult> =>
    window.api.scanFolderForSort(path, options) as Promise<SortScanResult>,
  scanFiles: (paths: string[]): Promise<FileEntry[]> =>
    window.api.scanFiles(paths) as Promise<FileEntry[]>,
  classifyPaths: (paths: string[]): Promise<{ folders: string[]; files: string[] }> =>
    window.api.classifyPaths(paths) as Promise<{ folders: string[]; files: string[] }>,
  pathForFile: (file: File): string => window.api.getPathForFile(file)
}

export interface DuplicateGroup {
  hash: string
  size: number
  paths: string[]
}

export const sortApi = {
  preview: (files: FileEntry[]): Promise<ClassifiedFile[]> =>
    window.api.previewSort(files) as Promise<ClassifiedFile[]>,
  correctClassification: (params: {
    filePath: string
    category: string
    subcategory: string | null
  }): Promise<{ success: boolean }> =>
    window.api.correctClassification(params) as Promise<{ success: boolean }>,
  execute: (
    files: ClassifiedFile[],
    outputDir: string,
    mode: 'copy' | 'move',
    approvedRenames?: Record<string, string>
  ): Promise<SortBatch> =>
    window.api.executeSort({ files, outputDir, mode, approvedRenames }) as Promise<SortBatch>,
  undo: (batchId: string): Promise<UndoReply> => window.api.undoSort(batchId) as Promise<UndoReply>,
  getHistory: (limit: number, offset: number): Promise<SortBatch[]> =>
    window.api.getHistory({ limit, offset }) as Promise<SortBatch[]>,
  deleteBatch: (batchId: string): Promise<void> => window.api.deleteBatch(batchId) as Promise<void>,
  clearHistory: (): Promise<void> => window.api.clearHistory() as Promise<void>,
  detectDuplicates: (files: { path: string; size: number }[]): Promise<DuplicateGroup[]> =>
    window.api.detectDuplicates(files) as Promise<DuplicateGroup[]>,
  trashFiles: (paths: string[]): Promise<{ trashed: number; total: number }> =>
    window.api.trashFiles(paths) as Promise<{ trashed: number; total: number }>,
  detectEmptyFolders: (path: string): Promise<string[]> =>
    window.api.detectEmptyFolders(path) as Promise<string[]>,
  onProgress: (callback: (progress: SortProgress) => void): (() => void) =>
    window.api.onSortProgress(callback as (p: unknown) => void),
  onClassifyProgress: (
    callback: (progress: {
      completed: number
      total: number
      currentFile: string
      phase?: 'classifying' | 'extracting' | 'classifying-ai' | 'done'
      elapsedMs?: number
      /** Files whose type would need reading, on the 'done' event — real under Smart Local too. */
      escalated?: number
      /** Which sorter actually ran, on the 'done' event. Not always the one chosen. */
      sorter?: AppSettings['sorterSource']
    }) => void
  ): (() => void) =>
    window.api.onClassifyProgress(
      callback as (p: { completed: number; total: number; currentFile: string }) => void
    )
}

export const watchApi = {
  list: (): Promise<WatchFolder[]> => window.api.listWatchFolders() as Promise<WatchFolder[]>,
  add: (path: string, outputPath: string, sortMode: 'copy' | 'move'): Promise<WatchFolder> =>
    window.api.addWatchFolder({ path, outputPath, sortMode }) as Promise<WatchFolder>,
  remove: (folderId: number): Promise<void> =>
    window.api.removeWatchFolder(folderId) as Promise<void>,
  toggle: (id: number, enabled: boolean): Promise<void> =>
    window.api.toggleWatchFolder({ id, enabled }) as Promise<void>,
  setMode: (id: number, sortMode: 'copy' | 'move'): Promise<WatchFolder> =>
    window.api.setWatchFolderMode({ id, sortMode }) as Promise<WatchFolder>,
  onEvent: (callback: (event: WatchEvent) => void): (() => void) =>
    window.api.onWatchEvent(callback as (e: unknown) => void)
}

export interface ClassificationRule {
  extension: string
  category: string
  subcategory: string | null
}

export interface SortPreset {
  name: string
  sourcePath: string
  outputPath: string
  mode: 'copy' | 'move'
}

export interface AppSettings {
  defaultSortMode: 'copy' | 'move'
  defaultOutputDir: string | null
  theme: 'light' | 'dark' | 'system'
  hasSeenOnboarding: boolean
  hasSeenTour: boolean
  hasCompletedFirstSort: boolean
  classificationRules: ClassificationRule[]
  sortPresets: SortPreset[]
  appLanguage: string
  updateFrequency: 'daily' | 'weekly' | 'manual'
  assistantHotkeyEnabled: boolean
  projectsRoot: string | null
  assistantModel: string
  assistantProvider: 'api-key' | 'claude-code'
  claudeCodePath: string | null
  sidebarCollapsed: boolean
  filesGroupOpen: boolean
  voiceEnabled: boolean
  voiceHotkey: 'Alt+Space' | 'Control+Space' | 'Shift+Space'
  voiceSttModel: 'fast' | 'accurate'
  voiceSpeakReplies: boolean
  voiceTtsEngine: 'kokoro' | 'system'
  voiceTtsVoice: string
  voiceMode: boolean
  /** Which sorter reads the user's files: fully local, or their own Claude. */
  sorterSource: 'smart-local' | 'claude'
  noticesEnabled: boolean
  briefingTime: string
  briefingStyle: 'facts' | 'written'
  noticeKinds: Record<NoticeKind, boolean>
  noticesPermissionAsked: boolean
  noticesPausedUntil: string | null
}

export type NoticeKind = 'briefing' | 'disk' | 'meeting' | 'agenda' | 'clutter'

export const noticesApi = {
  preview: (): Promise<{ delivered: boolean }> =>
    window.api.noticesPreview() as Promise<{ delivered: boolean }>,
  /** Raises the macOS permission prompt, by posting the first notification. */
  announce: (): Promise<void> => window.api.noticesAnnounce() as Promise<void>,
  resume: (): Promise<void> => window.api.noticesResume() as Promise<void>
}

export const settingsApi = {
  get: (): Promise<AppSettings> => window.api.getSettings() as unknown as Promise<AppSettings>,
  set: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    window.api.setSettings(partial as Record<string, unknown>) as unknown as Promise<AppSettings>
}

export interface UpdateCheckResult {
  status: 'available' | 'up-to-date' | 'failed'
  version: string | null
  url: string | null
}

export const updaterApi = {
  check: (): Promise<UpdateCheckResult> =>
    window.api.checkForUpdates() as Promise<UpdateCheckResult>,
  onUpdateAvailable: (cb: (info: { version: string; url: string }) => void) =>
    window.api.onUpdateAvailable(cb)
}

export interface ContextMenuStatus {
  installed: boolean
  platform: string
}

export const contextMenuApi = {
  install: (): Promise<ContextMenuStatus> =>
    window.api.installContextMenu() as Promise<ContextMenuStatus>
}

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly'

export interface ScheduledSort {
  id: number
  name: string
  sourcePath: string
  outputPath: string
  mode: 'copy' | 'move'
  frequency: ScheduleFrequency
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string
  createdAt: string
}

export const scheduleApi = {
  list: (): Promise<ScheduledSort[]> => window.api.listSchedules() as Promise<ScheduledSort[]>,
  create: (params: {
    name: string
    sourcePath: string
    outputPath: string
    mode: 'copy' | 'move'
    frequency: ScheduleFrequency
  }): Promise<ScheduledSort> => window.api.createSchedule(params) as Promise<ScheduledSort>,
  toggle: (id: number, enabled: boolean): Promise<void> =>
    window.api.toggleSchedule({ id, enabled }) as Promise<void>,
  remove: (id: number): Promise<void> => window.api.removeSchedule(id) as Promise<void>,
  runNow: (id: number): Promise<void> => window.api.runScheduleNow(id) as Promise<void>
}

export const appApi = {
  onOpenFolderForSort: (cb: (folderPath: string) => void) => window.api.onOpenFolderForSort(cb),
  onNavigate: (cb: (view: string) => void) => window.api.onNavigate(cb)
}

export interface SearchResult {
  filePath: string
  fileName: string
  category: string
  subcategory: string | null
  snippet: string
  score: number
  source: 'keyword' | 'semantic' | 'both'
}

export interface SearchStats {
  indexedFiles: number
  totalEmbeddings: number
  lastIndexedAt: string | null
}

export interface FilePreviewResult {
  success: boolean
  error?: string
  preview?: {
    type: 'image' | 'text' | 'metadata'
    content: string
  }
}

export const searchApi = {
  query: (
    query: string,
    options?: { fileType?: string; category?: string; limit?: number }
  ): Promise<SearchResult[]> => window.api.searchFiles(query, options) as Promise<SearchResult[]>,
  stats: (): Promise<SearchStats> => window.api.getSearchStats() as Promise<SearchStats>,
  deepScan: (
    files: Array<{ path: string; name: string }>
  ): Promise<{ indexed: number; total: number }> =>
    window.api.deepScan(files) as Promise<{ indexed: number; total: number }>,
  onScanProgress: (
    callback: (progress: {
      current: number
      total: number
      currentFile: string
      phase: string
    }) => void
  ): (() => void) => window.api.onScanProgress(callback),
  filePreview: (filePath: string): Promise<FilePreviewResult> =>
    window.api.filePreview(filePath) as Promise<FilePreviewResult>
}
