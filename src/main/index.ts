import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import log from 'electron-log'
import { randomUUID } from 'crypto'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { pathToFileURL } from 'url'
import { existsSync, statSync } from 'fs'
import { optimizer, is } from './lib/electronUtils'
import { installWebContentsGuard } from './infrastructure/security/webContentsGuard'
import icon from '../../resources/icon.png?asset'

import { getDatabase, closeDatabase } from './infrastructure/database'
import { SortHistoryRepo } from './domain/sorting/repository/SortHistoryRepo'
import { SortExecutor } from './domain/sorting/services/SortExecutor'
import { UndoService } from './domain/sorting/services/UndoService'
import { WatchFolderRepo } from './domain/watching/repository/WatchFolderRepo'
import { WatchService } from './domain/watching/services/WatchService'
import { ExtensionClassifier } from './domain/classification/services/ExtensionClassifier'
import { MetadataClassifier } from './domain/classification/services/MetadataClassifier'
import { ClassificationPipeline } from './domain/classification/services/ClassificationPipeline'
import { ClassificationCacheRepo } from './domain/classification/repository/ClassificationCacheRepo'
import { registerFolderIpc } from './infrastructure/ipc/folder.ipc'
import { registerSortIpc } from './infrastructure/ipc/sort.ipc'
import { registerWatchIpc } from './infrastructure/ipc/watch.ipc'
import { registerSettingsIpc } from './infrastructure/ipc/settings.ipc'
import { TextExtractor } from './domain/classification/services/TextExtractor'
import { checkForUpdate } from './infrastructure/updater/releaseCheck'

/** Long enough for the window and services to settle; short enough to land in the first minute. */
const STARTUP_UPDATE_CHECK_DELAY_MS = 15_000
import { settingsStore } from './infrastructure/storage/SettingsStore'
import { contextMenuService } from './infrastructure/os/ContextMenuService'
import { ScheduledSortRepo } from './domain/scheduling/repository/ScheduledSortRepo'
import { SchedulerService } from './domain/scheduling/services/SchedulerService'
import { registerScheduleIpc } from './infrastructure/ipc/schedule.ipc'
import { SearchIndexRepo } from './domain/search/repository/SearchIndexRepo'
import { SearchService } from './domain/search/services/SearchService'
import { RecallService } from './domain/search/services/RecallService'
import { DeepScanService } from './domain/search/services/DeepScanService'
import { registerSearchIpc } from './infrastructure/ipc/search.ipc'
import { postNotification } from './infrastructure/notices/postNotification'
import { AssistantWindowManager } from './infrastructure/assistant/AssistantWindowManager'
import { registerAgentIpc } from './infrastructure/ipc/agent.ipc'
import { registerVoiceIpc } from './infrastructure/ipc/voice.ipc'
import { VoiceNarrator } from './infrastructure/voice/VoiceNarrator'
import { Speaker } from './infrastructure/voice/Speaker'
import { TtsWorker } from './infrastructure/voice/TtsWorker'
import { KokoroSpeaker } from './infrastructure/voice/KokoroSpeaker'
import { AfplayPlayer } from './infrastructure/voice/AfplayPlayer'
import { SpeechRouter } from './infrastructure/voice/SpeechRouter'
import { KOKORO_MODEL } from './domain/ai/voicePresets'
import { ActionLogRepo } from './infrastructure/agent/ActionLogRepo'
import { CaptureLogRepo } from './domain/capture/CaptureLogRepo'
import { ApiKeyStore } from './infrastructure/agent/ApiKeyStore'
import { ConversationRepo } from './domain/conversation/repository/ConversationRepo'
import { ConversationRecorder } from './domain/conversation/services/ConversationRecorder'
import { buildCapabilities } from './infrastructure/agent/capabilityDeps'
import { screenDeps } from './infrastructure/agent/screenDeps'
import { CapabilityRegistry } from './domain/instruction/model/CapabilityRegistry'
import { BriefingService } from './domain/briefing/services/BriefingService'
import { NoticeWatcher } from './domain/briefing/services/NoticeWatcher'
import { TriageService } from './domain/briefing/services/TriageService'
import { ProactiveScheduler } from './domain/briefing/services/ProactiveScheduler'
import { capabilityReader } from './domain/briefing/services/readCapability'
import { noticeDelivery } from './infrastructure/notices/NoticeDelivery'
import { registerNoticesIpc } from './infrastructure/ipc/notices.ipc'
import { isAllDayPause, resolveKillAction } from './domain/briefing/model/noticePause'
import { pauseNoticesForToday } from './infrastructure/notices/pauseNotices'
import { readdir } from 'fs/promises'

import { createTray, destroyTray } from './infrastructure/tray/TrayService'
import { DevBridge } from './infrastructure/bridge/DevBridge'

const CONVERSATION_RETENTION_DAYS = 30

let mainWindow: BrowserWindow | null = null

// Browser dev bridge — lets a plain browser tab at localhost:5173 drive the app in dev
const devBridge =
  is.dev && process.env['ELECTRON_RENDERER_URL']
    ? new DevBridge(Number(new URL(process.env['ELECTRON_RENDERER_URL']).port))
    : null
let schedulerService: SchedulerService | null = null
let proactiveScheduler: ProactiveScheduler | null = null

// Tracks a sort URL received before app is ready (cold launch via protocol)
let pendingSortPath: string | null = null

function resolveSortFolder(inputPath: string): string {
  try {
    const stats = statSync(inputPath)
    if (stats.isFile()) return dirname(inputPath)
  } catch {
    // path doesn't exist or is inaccessible — pass as-is
  }
  return inputPath
}

function handleSortPath(inputPath: string): void {
  if (!mainWindow) return
  mainWindow.show()
  mainWindow.focus()
  mainWindow.webContents.send('app:open-folder-for-sort', resolveSortFolder(inputPath))
  devBridge?.broadcast('app:open-folder-for-sort', resolveSortFolder(inputPath))
}

function extractSortPath(argv: string[]): string | null {
  const arg = argv.find((a) => a.startsWith('--sort-path='))
  if (arg) return arg.split('=').slice(1).join('=').replace(/^"|"$/g, '')
  return null
}

function extractSortPathFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'talyx:' && parsed.hostname === 'sort') {
      return parsed.searchParams.get('path')
    }
  } catch {
    // not a valid URL
  }
  return null
}

function extractSortPathFromCliArgs(argv: string[]): string | null {
  // Support both --sort-path and legacy --quicksort-path
  const arg = argv.find((a) => a.startsWith('--sort-path=') || a.startsWith('--quicksort-path='))
  if (arg) return arg.split('=').slice(1).join('=').replace(/^"|"$/g, '')
  return null
}

function extractSortPathFromProtocol(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (
      parsed.protocol === 'talyx:' &&
      (parsed.hostname === 'sort' || parsed.hostname === 'quicksort')
    ) {
      return parsed.searchParams.get('path')
    }
  } catch {
    // not a valid URL
  }
  return null
}

let watchService: WatchService | null = null
let assistantWindow: AssistantWindowManager | null = null
let agentAbort: () => void = () => {}
let voiceDispose: () => void = () => {}

function initializeServices(): void {
  const db = getDatabase()

  // Repositories
  const historyRepo = new SortHistoryRepo(db)
  const watchFolderRepo = new WatchFolderRepo(db)

  // Shared services
  const textExtractor = new TextExtractor()

  // Content-addressed classification cache — re-sorts skip the AI for known files
  const classificationCacheRepo = new ClassificationCacheRepo(db)

  // Search infrastructure
  const searchIndexRepo = new SearchIndexRepo(db)
  const searchService = new SearchService(searchIndexRepo)
  const conversations = new ConversationRepo(db)
  const recallService = new RecallService(searchIndexRepo, conversations)
  const deepScanService = new DeepScanService(
    searchIndexRepo,
    textExtractor,
    new ExtensionClassifier()
  )

  // Classification pipeline (Smart Local: extension + metadata)
  const pipeline = new ClassificationPipeline(new ExtensionClassifier(), new MetadataClassifier())

  // Load custom classification rules from settings
  const settings = settingsStore.store
  pipeline.setCustomRules(settings.classificationRules ?? [])

  // Sorting services
  const executor = new SortExecutor(historyRepo, deepScanService)
  const undoService = new UndoService(historyRepo)

  // Watch service with event forwarding to renderer + native notifications
  watchService = new WatchService(watchFolderRepo, pipeline, executor, (event) => {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('watch:event', event)
    }
    devBridge?.broadcast('watch:event', event)

    // Native OS notification
    if (event.type === 'file-sorted') {
      const fileName = event.filePath.split('/').pop() ?? event.filePath
      postNotification({
        title: 'File Sorted',
        body: `${fileName} → ${event.category ?? 'Unknown'}`
      })
    } else if (event.type === 'error') {
      postNotification({
        title: 'Watch Error',
        body: event.error ?? 'Failed to sort file'
      })
    }
  })

  // Scheduled sorts
  const scheduledSortRepo = new ScheduledSortRepo(db)
  schedulerService = new SchedulerService(scheduledSortRepo, pipeline, executor, (event) => {
    if (event.type === 'sort-completed') {
      postNotification({
        title: 'Scheduled Sort Complete',
        body: `"${event.scheduleName}" sorted ${event.fileCount ?? 0} files`
      })
    } else if (event.type === 'sort-failed') {
      postNotification({
        title: 'Scheduled Sort Failed',
        body: `"${event.scheduleName}": ${event.error ?? 'Unknown error'}`
      })
    }
  })

  // Register all IPC handlers (bridge tap first — it must see every registration)
  devBridge?.installTap(ipcMain)
  registerFolderIpc()
  // Holds the voice models (whisper, Kokoro).
  const modelsDir = join(app.getPath('userData'), 'models')

  // One account, one place: the assistant and the sorter ask the same store.
  const apiKeyStore = new ApiKeyStore(app.getPath('userData'))

  registerSortIpc({
    pipeline,
    executor,
    undoService,
    historyRepo,
    settingsStore,
    textExtractor,
    classificationCacheRepo,
    apiKeyStore
  })
  registerWatchIpc(watchFolderRepo, watchService)
  registerSettingsIpc(pipeline)
  registerScheduleIpc(scheduledSortRepo, schedulerService)
  registerSearchIpc(searchService, searchIndexRepo, deepScanService)

  // Assistant overlay
  const overlayPreload = join(__dirname, '../preload/index.js')
  assistantWindow = new AssistantWindowManager(
    (settingsStore.store as unknown as Record<string, unknown>)['quickSearchShortcut'] as
      | string
      | undefined
  )
  assistantWindow.createWindow(overlayPreload)

  const actionLog = new ActionLogRepo(db)
  const captureLog = new CaptureLogRepo(db)
  // One sweep at launch is impossible to get wrong, and the app is opened often.
  conversations.removeOlderThan(CONVERSATION_RETENTION_DAYS)
  actionLog.removeOlderThan(CONVERSATION_RETENTION_DAYS)
  const recorder = new ConversationRecorder(conversations, () => randomUUID())
  // Read once: the registry is built now, so a later Settings change must not
  // let the Ask page offer abilities that were never registered.
  const hasProjects = existsSync(settingsStore.store.projectsRoot ?? join(homedir(), 'Code'))
  // Nothing that speaks first may change anything, so the reader refuses any
  // ability that is not read-only. The signal never aborts: a briefing has no
  // kill switch of its own, it simply asks four questions and stops.
  const readCapability = capabilityReader(
    () => registry,
    () => ({
      home: homedir(),
      projectsRoot: settingsStore.store.projectsRoot ?? join(homedir(), 'Code'),
      signal: new AbortController().signal,
      logger: { info: (m: string) => log.info(m), warn: (m: string) => log.warn(m) }
    })
  )
  const briefing = new BriefingService({ read: readCapability, now: () => new Date() })
  const noticeWatcher = new NoticeWatcher({
    read: readCapability,
    now: () => new Date(),
    // One readdir, no recursion: the count runs every minute and only ever
    // asks how crowded the top of the folder is.
    countLooseFiles: async (folderPath) => {
      const entries = await readdir(folderPath, { withFileTypes: true })
      return entries.filter((e) => e.isFile() && !e.name.startsWith('.')).length
    },
    downloadsPath: join(homedir(), 'Downloads'),
    warn: (message) => log.warn(message)
  })
  const triageService = new TriageService(noticeWatcher)
  const registry: CapabilityRegistry = new CapabilityRegistry(
    buildCapabilities({
      hasProjects,
      pipeline,
      searchIndexRepo,
      actionLog,
      textExtractor,
      historyRepo,
      recallService,
      triageService,
      registry: () => registry,
      briefing,
      screen: screenDeps(),
      pausedUntil: () => settingsStore.store.noticesPausedUntil,
      setPausedUntil: (noticesPausedUntil) => settingsStore.set({ noticesPausedUntil })
    })
  )
  const voice = registerVoiceIpc({ settingsStore, modelsDir })
  /** Drives the orb in both windows: Talyx is talking, or it is not. */
  const reportSpeaking = (speaking: boolean): void => {
    for (const win of [assistantWindow?.getWindow(), mainWindow]) {
      if (win && !win.isDestroyed()) win.webContents.send('voice:speaking', { speaking })
    }
    devBridge?.broadcast('voice:speaking', { speaking })
  }
  const systemSpeaker = new Speaker(reportSpeaking)
  const tts = new TtsWorker({ modelId: KOKORO_MODEL.modelId, modelsDir: voice.voiceModelsDir })
  const kokoroSpeaker = new KokoroSpeaker({
    synth: tts,
    player: new AfplayPlayer(),
    fallback: systemSpeaker,
    tempDir: app.getPath('temp'),
    onSpeaking: reportSpeaking
  })
  voice.setPreviewSpeaker(kokoroSpeaker)
  const speech = new SpeechRouter({
    kokoro: kokoroSpeaker,
    system: systemSpeaker,
    settings: () => ({
      voiceTtsEngine: settingsStore.store.voiceTtsEngine,
      voiceTtsVoice: settingsStore.store.voiceTtsVoice,
      appLanguage: settingsStore.store.appLanguage
    }),
    kokoroReady: voice.kokoroReady,
    ensureVoice: voice.ensureVoice
  })
  const narrator = new VoiceNarrator(speech, () => ({
    voiceSpeakReplies: settingsStore.store.voiceSpeakReplies,
    voiceMode: settingsStore.store.voiceMode,
    appLanguage: settingsStore.store.appLanguage
  }))
  voiceDispose = () => {
    voice.dispose()
    tts.dispose()
    narrator.stop()
  }
  const agent = registerAgentIpc({
    registry,
    hasProjects,
    actionLog,
    captureLog,
    apiKeyStore,
    settingsStore,
    conversations,
    recorder,
    narrator,
    windows: {
      overlay: () => assistantWindow!.getWindow(),
      main: () => mainWindow,
      showOverlay: (options) => assistantWindow!.show(options),
      showOverlayForApproval: () => assistantWindow!.showForApproval(),
      hideOverlay: () => assistantWindow!.hide(),
      hideOverlayWindowOnly: () => assistantWindow!.hideWindowOnly(),
      fitOverlayHeight: (height) => assistantWindow!.fitHeight(height),
      setApprovalPending: (pending) => assistantWindow!.setApprovalPending(pending)
    },
    quietBriefingVisible: () => assistantWindow!.isQuietBriefingVisible(),
    pauseNoticesForToday: () => pauseNoticesForToday(settingsStore),
    broadcast: (channel, payload) => devBridge?.broadcast(channel, payload)
  })
  assistantWindow.registerKillShortcut(() => {
    const settings = settingsStore.store
    const action = resolveKillAction({
      busy: agent.busy(),
      noticesEnabled: settings.noticesEnabled,
      // A focus pause ends with the meeting; ⌘⇧Esc during one still means "the rest of the day".
      paused: isAllDayPause(settings.noticesPausedUntil, new Date()),
      overlayVisible: assistantWindow!.isOverlayVisible()
    })
    if (action === 'abort') agent.abort()
    else if (action === 'pause-notices') pauseNoticesForToday(settingsStore)
    else if (action === 'hide') assistantWindow!.hide()
  })
  agentAbort = agent.abort

  proactiveScheduler = new ProactiveScheduler({
    now: () => new Date(),
    settings: () => ({
      noticesEnabled: settingsStore.store.noticesEnabled,
      briefingTime: settingsStore.store.briefingTime,
      briefingStyle: settingsStore.store.briefingStyle,
      noticeKinds: settingsStore.store.noticeKinds
    }),
    marks: () => settingsStore.store.noticeMarks,
    saveMarks: (noticeMarks) => settingsStore.set({ noticeMarks }),
    pausedUntil: () => settingsStore.store.noticesPausedUntil,
    savePausedUntil: (noticesPausedUntil) => settingsStore.set({ noticesPausedUntil }),
    briefing,
    watcher: noticeWatcher,
    deliver: noticeDelivery({
      push: agent.push,
      showQuietly: () => assistantWindow!.showQuietly(),
      show: () => assistantWindow!.show()
    }),
    speak: async (instruction) => agent.runAlone(instruction),
    busy: agent.busy,
    warn: (message) => log.warn(message)
  })
  registerNoticesIpc(proactiveScheduler)

  void devBridge?.start(Number(process.env['TALYX_BRIDGE_PORT'] ?? 5175))

  // Start watching enabled folders and scheduled sorts
  watchService.startAll()
  schedulerService.start()
  proactiveScheduler.start()

  // Window material follows the app theme (see syncNativeTheme)
  syncNativeTheme(settingsStore.store.theme ?? 'system')
  ipcMain.handle('theme:set-native', (_event, theme: unknown) => {
    syncNativeTheme(theme)
  })
}

/**
 * Keep the OS-rendered window material (vibrancy blur) in the same
 * appearance as the app theme — otherwise a light app over a dark-mode
 * system gets a dark frost behind it and reads as gray mud.
 */
function syncNativeTheme(theme: unknown): void {
  if (theme === 'light' || theme === 'dark' || theme === 'system') {
    nativeTheme.themeSource = theme
  }
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    transparent: false,
    // Real glass: macOS blurs the desktop behind the window. The renderer keeps a
    // translucent background so it shows through.
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 320,
    height: 380,
    frame: false,
    resizable: false,
    transparent: false,
    backgroundColor: '#0a0a0a',
    alwaysOnTop: true,
    center: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/splash.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    splash.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/splash.html`)
  } else {
    splash.loadFile(join(__dirname, '../renderer/splash.html'))
  }

  return splash
}

app.whenReady().then(async () => {
  const gotTheLock = app.requestSingleInstanceLock()

  if (!gotTheLock) {
    log.warn('[Main] Another instance holds the single-instance lock — quitting')
    app.quit()
    return
  }

  installWebContentsGuard(
    is.dev && process.env['ELECTRON_RENDERER_URL']
      ? `${new URL(process.env['ELECTRON_RENDERER_URL']).origin}/`
      : `${pathToFileURL(join(__dirname, '../renderer')).href}/`
  )

  app.on('second-instance', (_event, argv) => {
    // Check CLI args for sort path
    const cliSortPath = extractSortPathFromCliArgs(argv)
    if (cliSortPath) {
      handleSortPath(cliSortPath)
      return
    }

    // Check URL args (talyx://sort?path=...)
    const urlArg = argv.find((a) => a.startsWith('talyx://'))
    if (urlArg) {
      const urlSortPath = extractSortPathFromProtocol(urlArg) ?? extractSortPathFromUrl(urlArg)
      if (urlSortPath) {
        handleSortPath(urlSortPath)
        return
      }
    }

    // Legacy --sort-path opens full window
    const sortPath = extractSortPath(argv)
    if (sortPath) {
      handleSortPath(sortPath)
      return
    }

    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  if (!is.dev) {
    app.setAsDefaultProtocolClient('talyx')
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('updater:check', () => checkForUpdate(mainWindow))

  // Context menu integration
  ipcMain.handle('context-menu:install', () => {
    contextMenuService.install()
    return contextMenuService.status()
  })

  // --- Splash-first startup flow ---
  const splash = createSplashWindow()

  // Wait for splash to load before sending IPC — but never let a failed or
  // stalled window load block backend startup (headless/agent environments,
  // corrupt splash assets). Services must come up regardless.
  await new Promise<void>((resolve) => {
    const proceed = (): void => {
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(() => {
      log.warn('[Main] Splash did not load within 5s — continuing startup without it')
      proceed()
    }, 5000)
    splash.webContents.once('did-finish-load', () => {
      splash.show()
      proceed()
    })
    splash.webContents.once('did-fail-load', (_e, code, desc) => {
      log.warn(`[Main] Splash failed to load (${code} ${desc}) — continuing startup`)
      proceed()
    })
  })

  splash.webContents.send('splash:version', app.getVersion())

  if (!is.dev) {
    // Production: brief splash, updates handled after app starts via sidebar
    splash.webContents.send('splash:status', 'Starting...')
    await new Promise((resolve) => setTimeout(resolve, 800))
  } else {
    // Dev mode: show splash briefly
    splash.webContents.send('splash:status', 'Starting (dev)...')
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  splash.webContents.send('splash:status', 'Starting...')

  // Initialize backend services and IPC
  try {
    initializeServices()
  } catch (err) {
    console.error('[Talyx] initializeServices failed:', err)
    splash.webContents.send(
      'splash:status',
      `Error: ${err instanceof Error ? err.message : String(err)}`
    )
    return
  }

  const win = createWindow()
  mainWindow = win

  // Drain any sort path received before services were ready (cold protocol launch)
  if (pendingSortPath) {
    handleSortPath(pendingSortPath)
    pendingSortPath = null
  }

  // Wait for main window to be ready, then swap splash for main
  win.once('ready-to-show', () => {
    splash.close()
    win.show()
  })

  // Fallback: force show after 8s in case ready-to-show never fires
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      console.warn('[Talyx] ready-to-show timeout — forcing window show')
      if (!splash.isDestroyed()) splash.close()
      win.show()
    }
  }, 8000)

  if (settingsStore.store.assistantHotkeyEnabled !== false) assistantWindow?.registerShortcut()

  // Release check: tells the user about a newer release (skip in dev mode)
  if (!is.dev) {
    // Check once shortly after launch, then on the user's interval. Without the
    // launch check, a user who quits the app every day never sees an update.
    const freq = settingsStore.store.updateFrequency ?? 'daily'
    if (freq !== 'manual') {
      const intervalMs = freq === 'daily' ? 24 * 60 * 60_000 : 7 * 24 * 60 * 60_000
      const checkUnlessManual = (): void => {
        const current = settingsStore.store.updateFrequency ?? 'daily'
        if (current !== 'manual') void checkForUpdate(mainWindow)
      }
      setTimeout(checkUnlessManual, STARTUP_UPDATE_CHECK_DELAY_MS)
      setInterval(checkUnlessManual, intervalMs)
    }
  }

  // System tray for background operation
  createTray(
    () => mainWindow,
    () => agentAbort()
  )

  // Handle macOS deep links (talyx://sort?path=...)
  app.on('open-url', (_event, url) => {
    const path = extractSortPathFromProtocol(url) ?? extractSortPathFromUrl(url)
    if (path) handleSortPath(path)
  })

  // Check if launched with --sort-path or --quicksort-path CLI arg
  const sortPathFromArgs = extractSortPathFromCliArgs(process.argv) ?? extractSortPath(process.argv)
  if (sortPathFromArgs) {
    win.webContents.once('did-finish-load', () => {
      handleSortPath(sortPathFromArgs)
    })
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      mainWindow.once('ready-to-show', () => mainWindow!.show())
    }
  })

  // No quit here: the app stays alive for scheduled sorts and the tray.
  app.on('window-all-closed', () => {})

  app.on('will-quit', async () => {
    proactiveScheduler?.stop()
    if (schedulerService) {
      schedulerService.stop()
    }
    if (watchService) {
      await watchService.stopAll()
    }
    voiceDispose()
    assistantWindow?.destroy()
    destroyTray()
    closeDatabase()
  })
})
