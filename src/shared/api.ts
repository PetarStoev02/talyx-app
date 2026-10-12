// Single source of truth for the window.api surface. The preload builds it
// over ipcRenderer; the browser dev bridge builds it over HTTP+SSE. Must not
// import 'electron' — it compiles in both the node and web tsconfigs.

export interface ApiTransport {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, listener: (...args: unknown[]) => void) => () => void
  getPathForFile: (file: File) => string
}

// The return type is deliberately inferred — it IS the definition of TalyxApi
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function buildApi(transport: ApiTransport) {
  return {
    // Folder operations
    selectFolder: () => transport.invoke('folder:select'),
    getHomeDir: () => transport.invoke('folder:home'),
    showInExplorer: (filePath: string) => transport.invoke('folder:show-in-explorer', filePath),
    openPath: (filePath: string) => transport.invoke('folder:open', filePath),
    scanFolder: (path: string) => transport.invoke('folder:scan', path),
    // Sent only when set: a trailing undefined becomes null over the browser
    // bridge, and null is not an object the handler can read.
    scanFolderForSort: (path: string, options?: { includeSubfolders?: boolean }) =>
      options
        ? transport.invoke('folder:scan-for-sort', path, options)
        : transport.invoke('folder:scan-for-sort', path),
    scanFiles: (paths: string[]) => transport.invoke('folder:scan-files', paths),
    classifyPaths: (paths: string[]) => transport.invoke('folder:classify-paths', paths),

    // Notices
    noticesPreview: () => transport.invoke('notices:preview'),
    noticesAnnounce: () => transport.invoke('notices:announce'),
    noticesPauseToday: () => transport.invoke('notices:pause-today'),
    noticesResume: () => transport.invoke('notices:resume'),

    // Assistant
    agentRun: (instruction: string) => transport.invoke('agent:run', { instruction }),
    captureDump: (text: string, chip: 'note' | 'reminder' | 'calendar' | 'file' | null = null) =>
      transport.invoke('capture:dump', { text, chip }),
    agentApprove: (decision: 'approve' | 'rest' | 'deny') =>
      transport.invoke('agent:approve', { decision }),
    agentAbort: () => transport.invoke('agent:abort'),
    agentReset: () => transport.invoke('agent:reset'),
    agentStatus: () => transport.invoke('agent:status'),
    agentHide: () => transport.invoke('agent:hide'),
    agentFitOverlay: (height: number) => transport.invoke('agent:fit-overlay', { height }),
    agentOpenSettings: () => transport.invoke('agent:open-settings'),
    agentSetApiKey: (key: string) => transport.invoke('agent:set-api-key', { key }),
    agentTestApiKey: (key: string) => transport.invoke('agent:test-api-key', { key }),
    agentTestClaudeCode: () => transport.invoke('agent:test-claude-code'),
    agentClearApiKey: () => transport.invoke('agent:clear-api-key'),
    claudeCodeInstall: () => transport.invoke('claude-code:install'),
    claudeCodeLogin: () => transport.invoke('claude-code:login'),
    claudeCodeCancelLogin: () => transport.invoke('claude-code:cancel-login'),
    onClaudeCodeInstallProgress: (callback: (line: string) => void) =>
      transport.on('claude-code:install-progress', (payload) =>
        callback((payload as { line: string }).line)
      ),
    onAgentEvent: (callback: (event: unknown) => void) =>
      transport.on('agent:event', (event) => callback(event)),
    conversationList: () => transport.invoke('conversation:list'),
    conversationOpen: (id: string) => transport.invoke('conversation:open', { id }),
    conversationDelete: (id: string) => transport.invoke('conversation:delete', { id }),
    conversationDeleteAll: () => transport.invoke('conversation:delete-all'),

    // Voice
    voicePermission: () => transport.invoke('voice:permission'),
    voiceTranscribe: (wavBase64: string) => transport.invoke('voice:transcribe', { wavBase64 }),
    voiceModelStatus: () => transport.invoke('voice:model-status'),
    voiceDownloadModel: (choice: string) => transport.invoke('voice:download-model', { choice }),
    onVoiceSpeaking: (callback: (speaking: boolean) => void) =>
      transport.on('voice:speaking', (payload) =>
        callback((payload as { speaking: boolean }).speaking)
      ),
    voiceTtsStatus: () => transport.invoke('voice:tts-status'),
    voiceDownloadTts: () => transport.invoke('voice:download-tts'),
    voicePreviewVoice: (voice: string) => transport.invoke('voice:preview-voice', { voice }),
    onVoiceDownloadProgress: (
      callback: (progress: { file: string; index: number; total: number; percent: number }) => void
    ) =>
      transport.on('voice:download-progress', (progress) =>
        callback(progress as { file: string; index: number; total: number; percent: number })
      ),

    // Electron 32 removed File.path; this is the supported replacement
    getPathForFile: (file: File) => transport.getPathForFile(file),

    // Sort operations
    previewSort: (files: unknown[]) => transport.invoke('sort:preview', files),
    executeSort: (params: {
      files: unknown[]
      outputDir: string
      mode: string
      approvedRenames?: Record<string, string>
    }) => transport.invoke('sort:execute', params),
    undoSort: (batchId: string) => transport.invoke('sort:undo', batchId),
    getHistory: (params: { limit: number; offset: number }) =>
      transport.invoke('sort:history', params),
    deleteBatch: (batchId: string) => transport.invoke('sort:delete-batch', batchId),
    clearHistory: () => transport.invoke('sort:clear-history'),
    detectDuplicates: (files: { path: string; size: number }[]) =>
      transport.invoke('sort:detect-duplicates', files),
    trashFiles: (paths: string[]) =>
      transport.invoke('sort:trash-files', paths) as Promise<{ trashed: number; total: number }>,
    detectEmptyFolders: (path: string) =>
      transport.invoke('sort:detect-empty-folders', path) as Promise<string[]>,

    // Sort progress listener
    onSortProgress: (callback: (progress: unknown) => void) =>
      transport.on('sort:progress', (progress) => callback(progress)),

    // Classification progress listener
    onClassifyProgress: (
      callback: (progress: { completed: number; total: number; currentFile: string }) => void
    ) =>
      transport.on('sort:classify-progress', (progress) =>
        callback(progress as { completed: number; total: number; currentFile: string })
      ),

    // Watch folder operations
    listWatchFolders: () => transport.invoke('watch:list'),
    addWatchFolder: (params: { path: string; outputPath: string; sortMode: string }) =>
      transport.invoke('watch:add', params),
    removeWatchFolder: (folderId: number) => transport.invoke('watch:remove', folderId),
    toggleWatchFolder: (params: { id: number; enabled: boolean }) =>
      transport.invoke('watch:toggle', params),
    setWatchFolderMode: (params: { id: number; sortMode: string }) =>
      transport.invoke('watch:set-mode', params),

    // Watch event listener
    onWatchEvent: (callback: (event: unknown) => void) =>
      transport.on('watch:event', (watchEvent) => callback(watchEvent)),

    // Settings
    getSettings: () => transport.invoke('settings:get'),
    setSettings: (partial: Record<string, unknown>) => transport.invoke('settings:set', partial),
    setNativeTheme: (theme: string) => transport.invoke('theme:set-native', theme),
    correctClassification: (params: {
      filePath: string
      category: string
      subcategory: string | null
    }) => transport.invoke('classification:correct', params),

    // Updater
    checkForUpdates: () => transport.invoke('updater:check'),
    onUpdateAvailable: (callback: (info: { version: string; url: string }) => void) =>
      transport.on('updater:update-available', (info) =>
        callback(info as { version: string; url: string })
      ),

    // Scheduled sorts
    listSchedules: () => transport.invoke('schedule:list'),
    createSchedule: (params: {
      name: string
      sourcePath: string
      outputPath: string
      mode: string
      frequency: string
    }) => transport.invoke('schedule:create', params),
    toggleSchedule: (params: { id: number; enabled: boolean }) =>
      transport.invoke('schedule:toggle', params),
    removeSchedule: (id: number) => transport.invoke('schedule:remove', id),
    runScheduleNow: (id: number) => transport.invoke('schedule:run-now', id),

    // Context menu integration
    installContextMenu: () => transport.invoke('context-menu:install'),

    // Deep link
    onOpenFolderForSort: (callback: (folderPath: string) => void) =>
      transport.on('app:open-folder-for-sort', (folderPath) => callback(folderPath as string)),

    // Navigation (from quick search overlay)
    onNavigate: (callback: (view: string) => void) =>
      transport.on('navigate', (view) => callback(view as string)),

    // The overlay was brought forward by the hotkey; it re-reads settings.
    onAssistantFocus: (callback: () => void) => transport.on('assistant:focus', () => callback()),

    // Search operations
    searchFiles: (
      query: string,
      options?: { fileType?: string; category?: string; limit?: number }
    ) => transport.invoke('search:query', query, options),
    getSearchStats: () => transport.invoke('search:stats'),
    deepScan: (files: Array<{ path: string; name: string }>) =>
      transport.invoke('search:deep-scan', files),
    onScanProgress: (
      callback: (progress: {
        current: number
        total: number
        currentFile: string
        phase: string
      }) => void
    ) =>
      transport.on('search:scan-progress', (progress) =>
        callback(progress as { current: number; total: number; currentFile: string; phase: string })
      ),
    // Reuses the quick-search preview handler: image/text/metadata preview for a file
    filePreview: (filePath: string) => transport.invoke('quicksearch:action', 'preview', filePath)
  }
}

export type TalyxApi = ReturnType<typeof buildApi>
