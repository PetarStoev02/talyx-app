import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import {
  FolderOpen,
  Play,
  ArrowDownUp,
  ScanSearch,
  Loader2,
  Save,
  Pencil,
  X,
  AlertTriangle,
  FolderMinus,
  FolderSearch,
  FileSearch
} from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Card, CardContent } from '@shared/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/tooltip'
import { PageHeader } from '@shared/ui/page-header'
import { EmptyState } from '@shared/ui/empty-state'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@shared/ui/resizable'
import { cn } from '@shared/lib/utils'
import { useSortSession } from '@app/providers/useSortSession'
import { useLanguage } from '@app/providers/useLanguage'
import type { TranslationKey } from '@shared/lib/i18n'
import { useNavigation } from '@app/providers/useNavigation'
import { DropZone, type DropResult } from '@features/drop-to-sort/DropZone'
import { overallSortProgress } from '@shared/lib/sortProgress'
import { announceUndo } from '@shared/lib/undoToast'
import { agentApi, brainReady, type AgentStatus } from '@shared/api/agent'
import {
  folderApi,
  sortApi,
  settingsApi,
  type SortPreset,
  type ClassifiedFile,
  type DuplicateGroup,
  type SealedFolder,
  type FileEntry,
  type AppSettings
} from '@shared/api/ipc'
import { PresetBar } from './PresetBar'
import { PreviewTree } from './PreviewTree'
import { DuplicatesCard } from './DuplicatesCard'
import { ClassificationDetail } from './ClassificationDetail'
import { RenamePanel } from './RenamePanel'
import { SortSummaryCard, type SortSummary } from './SortSummaryCard'

/** Sentinel the rename panel writes to reject every suggestion at once. */
const ALL_REJECTED = '__ALL_REJECTED__'
/** How long nothing may move before the progress line says so. */
const STALL_MS = 20_000
/** Enough finished files that the average per file is worth extrapolating. */
const ETA_MIN_SAMPLE = 5

/** Phase names an owner who has never opened a terminal can read. */
const PHASE_LABELS: Record<string, TranslationKey> = {
  idle: 'sort.phaseScanning',
  scanning: 'sort.phaseScanning',
  classifying: 'sort.phaseSorting',
  extracting: 'sort.phaseReading',
  'classifying-ai': 'sort.phaseDeciding'
}

/** Rough time left from the rate so far, or null while it would be a guess. */
function remainingTime(completed: number, total: number, startedAt: number): string | null {
  if (completed < ETA_MIN_SAMPLE || completed >= total || startedAt === 0) return null
  const seconds = Math.round((((Date.now() - startedAt) / completed) * (total - completed)) / 1000)
  if (seconds < 10) return null
  if (seconds < 90) return `${seconds}s`
  return `${Math.round(seconds / 60)}m`
}

/**
 * Offers the deeper scan, saying up front how much more work it is — a folder
 * of folders can hold hundreds of files, and each one costs a model turn.
 */
function LookInsideButton({
  folders,
  files,
  onClick,
  variant
}: {
  folders: number
  files: number
  onClick: () => void
  variant?: 'default' | 'outline'
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <Button variant={variant ?? 'outline'} size="sm" onClick={onClick} className="gap-2">
      <FolderSearch className="h-3.5 w-3.5" />
      {t('sort.lookInside').replace('{folders}', String(folders))}
      <span className="opacity-60">
        · {t('sort.lookInsideCount').replace('{count}', files.toLocaleString())}
      </span>
    </Button>
  )
}

/**
 * The upgrade offered where it is earned: Smart Local sorted the batch, so a
 * connected Claude can be offered right here instead of behind a settings page
 * nobody opens. Same "sent" line Settings uses, so the consent this asks for
 * is the real one.
 */
function ClaudeOffer({
  count,
  onAccept
}: {
  count: number
  onAccept: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 text-xs">
      <FileSearch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="text-foreground">
        {t('sort.claudeOffer.line').replace('{count}', String(count))}
      </span>
      <span className="text-muted-foreground">{t('settings.sorter.claude.sent')}</span>
      <Button variant="outline" size="sm" onClick={onAccept} className="ml-auto shrink-0">
        {t('sort.claudeOffer.button')}
      </Button>
    </div>
  )
}

/** A count in the plan summary that filters the plan to just those files. */
function PlanCount({
  active,
  warn,
  onClick,
  children
}: {
  active: boolean
  warn?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium transition-colors',
        warn
          ? 'border-warning/30 bg-warning-subtle text-warning hover:bg-warning/20'
          : 'border-border bg-background/60 text-muted-foreground hover:bg-accent',
        active && 'ring-1 ring-ring'
      )}
    >
      {children}
    </button>
  )
}

export function SortPage(): React.JSX.Element {
  const {
    sourceFolder,
    outputFolder,
    mode,
    classified,
    status,
    progress,
    error,
    approvedRenames,
    setSourceFolder,
    setOutputFolder,
    setMode,
    setFiles,
    setClassified,
    setStatus,
    setProgress,
    setError,
    setBatchId,
    setApprovedRename,
    rejectRename,
    rejectAllRenames,
    rejectedRenames,
    clearApprovedRenames,
    approveAllRenames,
    reset
  } = useSortSession()

  const t = useLanguage((s) => s.t)
  const navigateTo = useNavigation((s) => s.navigate)

  const [presets, setPresets] = useState<SortPreset[]>([])
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  /** Which slice of the plan is on screen. The summary counts switch it. */
  const [focus, setFocus] = useState<'all' | 'renames' | 'duplicates'>('all')
  const [emptyFolders, setEmptyFolders] = useState<string[]>([])
  const [sealedFolders, setSealedFolders] = useState<SealedFolder[]>([])
  /** How many files a deeper scan would add, and whether this scan went deep. */
  const [nestedFileCount, setNestedFileCount] = useState(0)
  const [includeSubfolders, setIncludeSubfolders] = useState(false)
  const [sortSummary, setSortSummary] = useState<SortSummary | null>(null)

  const [scanPhase, setScanPhase] = useState<
    'idle' | 'scanning' | 'classifying' | 'extracting' | 'classifying-ai'
  >('idle')
  const [classifyProgress, setClassifyProgress] = useState<{
    completed: number
    total: number
    currentFile: string
    phase?: 'classifying' | 'extracting' | 'classifying-ai' | 'done'
    elapsedMs?: number
    creditsRemaining?: number
  } | null>(null)
  const [lastElapsedMs, setLastElapsedMs] = useState<number | null>(null)
  /** Which sorter actually read the files last scan — not always the one chosen. */
  const [lastSorterUsed, setLastSorterUsed] = useState<AppSettings['sorterSource'] | null>(null)
  const [sorterSource, setSorterSource] = useState<AppSettings['sorterSource']>('smart-local')
  const [claudeStatus, setClaudeStatus] = useState<AgentStatus | null>(null)
  const [smoothProgress, setSmoothProgress] = useState(0)
  const [smoothCount, setSmoothCount] = useState(0)
  const [currentFileName, setCurrentFileName] = useState('')
  const [stalled, setStalled] = useState(false)
  const scanStartedAt = useRef(0)

  const [droppedFiles, setDroppedFiles] = useState<string[]>([])
  const canScan = sourceFolder !== null
  const isScanning = status === 'scanning'
  const isSorting = status === 'sorting'
  const canSort = status === 'previewing' && classified.length > 0
  const allRenamesRejected = rejectedRenames.has(ALL_REJECTED)
  const renamedFiles = classified.filter(
    (f) =>
      approvedRenames[f.path] ??
      (f.classification.suggestedName &&
        !allRenamesRejected &&
        !rejectedRenames.has(f.path) &&
        f.classification.suggestedName !== f.name)
  )
  const renameCount = renamedFiles.length
  const duplicatePaths = new Set(duplicates.flatMap((g) => g.paths))
  const folderCount = new Set(
    classified.map((f) =>
      (f.classification.semanticPath ?? [f.classification.category, f.classification.subcategory])
        .filter(Boolean)
        .join('/')
    )
  ).size
  /** Nothing chosen yet — the page is one invitation, not a form. */
  const showEmpty = !sourceFolder && droppedFiles.length === 0 && status === 'idle'
  /** While the first plan is being worked out there is nothing else to show. */
  const showScanPanel = isScanning && classified.length === 0
  const plainSealedCount = sealedFolders.filter((f) => f.kind === 'folder').length
  function lookInside(): void {
    setIncludeSubfolders(true)
    handleScanAndPreview(true)
  }
  /** Sort only moves loose files, so a folder of folders yields no plan. */
  const foundNothing = status === 'previewing' && classified.length === 0
  const timeLeft = classifyProgress
    ? remainingTime(classifyProgress.completed, classifyProgress.total, scanStartedAt.current)
    : null
  /** The parts of the plan that are not files: untouched folders, and timing. */
  const planFootnotes = [
    sealedFolders.length === 1
      ? t('sort.planKeptIntactOne')
      : sealedFolders.length > 1
        ? t('sort.planKeptIntact').replace('{count}', String(sealedFolders.length))
        : null,
    emptyFolders.length === 1
      ? t('sort.planEmptyCleanedOne')
      : emptyFolders.length > 1
        ? t('sort.planEmptyCleaned').replace('{count}', String(emptyFolders.length))
        : null,
    // Under a second is not worth reporting, and reads as a bug when it rounds to 0.0s.
    includeSubfolders ? t('sort.lookingInside') : null,
    lastElapsedMs && lastElapsedMs >= 1000
      ? t('sort.analyzedIn').replace('{time}', `${Math.round(lastElapsedMs / 1000)}s`)
      : null
  ].filter((line): line is string => line !== null)
  const filterPaths =
    focus === 'renames'
      ? new Set(renamedFiles.map((f) => f.path))
      : focus === 'duplicates'
        ? duplicatePaths
        : null
  const claudeConnected = claudeStatus !== null && brainReady(claudeStatus)
  // Smart Local sorted this batch — a connected Claude can sort it better.
  const showClaudeOffer =
    status === 'previewing' &&
    sorterSource === 'smart-local' &&
    classified.length > 0 &&
    claudeConnected
  /**
   * The chosen sorter could not run and something else did. Says so in plain
   * words — nothing was sent, so nothing here may suggest otherwise.
   */
  const fallbackNotice =
    status === 'previewing' && lastSorterUsed !== null && lastSorterUsed !== sorterSource
      ? t('sort.sorterFallback.claude')
      : null
  async function handleTakeClaudeOffer(): Promise<void> {
    setSorterSource('claude')
    await settingsApi.set({ sorterSource: 'claude' })
    await handleScanAndPreview()
  }

  // Load saved defaults on first mount. SortPage remounts on every nav (App
  // renders <main key={currentView}>), so this also reruns after a scan —
  // `status` is then still 'previewing', not 'idle'. sorterSource and the
  // Claude connection check must survive that remount so the fallback notice
  // and the Claude offer stay accurate; only the user-edited fields below
  // (outputFolder, mode, presets) need the idle guard.
  useEffect(() => {
    settingsApi.get().then((settings) => {
      setSorterSource(settings.sorterSource)
      if (status !== 'idle') return
      if (!outputFolder && settings.defaultOutputDir) {
        setOutputFolder(settings.defaultOutputDir)
      }
      setMode(settings.defaultSortMode)
      setPresets(settings.sortPresets ?? [])
    })
    // Whether the owner's own Claude is connected — the same check Settings
    // uses. Needed on every remount, not just the idle one, or the offer
    // stays stuck at its initial null/false after a scan.
    agentApi.status().then(setClaudeStatus)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Smooth progress — tick counter and bar between real batch updates.
  // The bar maps every phase onto one 0-100 scale (overallSortProgress) and
  // is clamped monotonic so phase changes never make it jump backwards.
  const allFileNames = useRef<string[]>([])
  const progressFloor = useRef(0)
  const progressActive = classifyProgress !== null
  const progressTotal = classifyProgress?.total ?? 0
  const progressCompleted = classifyProgress?.completed ?? 0
  const progressPhase = classifyProgress?.phase
  const progressFile = classifyProgress?.currentFile
  useEffect(() => {
    if (!progressActive || progressTotal === 0) {
      progressFloor.current = 0
      setSmoothProgress(0)
      setSmoothCount(0)
      setCurrentFileName('')
      return undefined
    }
    const total = progressTotal
    const realCompleted = progressCompleted
    const phase = progressPhase

    function pushProgress(completedNow: number): void {
      const mapped = overallSortProgress(phase, completedNow, total)
      progressFloor.current = Math.max(progressFloor.current, mapped)
      setSmoothProgress(progressFloor.current)
    }

    setSmoothCount(realCompleted)
    pushProgress(realCompleted)

    // Store file names from batch for cycling display
    if (progressFile) {
      allFileNames.current = progressFile.split(', ')
    }

    if (realCompleted < total) {
      let tickCount = 0
      const batchSize = 20
      const filesInBatch = Math.min(batchSize, total - realCompleted)
      const interval = setInterval(() => {
        tickCount++
        const fakeProgress = Math.min(tickCount, filesInBatch - 1)
        setSmoothCount(realCompleted + fakeProgress)
        pushProgress(realCompleted + fakeProgress)
        // Cycle through filenames
        if (allFileNames.current.length > 0) {
          const idx = tickCount % allFileNames.current.length
          setCurrentFileName(allFileNames.current[idx])
        }
      }, 400)
      return () => clearInterval(interval)
    }
    pushProgress(total)
    return undefined
  }, [progressActive, progressCompleted, progressTotal, progressPhase, progressFile])

  // Nothing moving for a while is slow, not frozen — say which, so the owner
  // does not sit wondering whether to force-quit.
  useEffect(() => {
    setStalled(false)
    if (!isScanning) return undefined
    const timer = setTimeout(() => setStalled(true), STALL_MS)
    return () => clearTimeout(timer)
  }, [isScanning, classifyProgress?.completed])

  function openSavePresetDialog(): void {
    if (!sourceFolder || !outputFolder) return
    setPresetName(sourceFolder.split('/').pop() || 'Preset')
    setShowSavePreset(true)
  }

  async function handleSavePreset(): Promise<void> {
    if (!sourceFolder || !outputFolder || !presetName.trim()) return
    const preset: SortPreset = {
      name: presetName.trim(),
      sourcePath: sourceFolder,
      outputPath: outputFolder,
      mode
    }
    const updated = [...presets, preset]
    setPresets(updated)
    await settingsApi.set({ sortPresets: updated })
    setShowSavePreset(false)
    setPresetName('')
    toast.success(`Preset "${preset.name}" saved`)
  }

  function handleLoadPreset(preset: SortPreset): void {
    setSourceFolder(preset.sourcePath)
    setOutputFolder(preset.outputPath)
    setMode(preset.mode)
    setClassified([])
    setFiles([])
    setStatus('idle')
    setError(null)
  }

  async function handleDeletePreset(index: number): Promise<void> {
    const updated = presets.filter((_, i) => i !== index)
    setPresets(updated)
    await settingsApi.set({ sortPresets: updated })
    toast.success('Preset deleted')
  }

  async function handleRenamePreset(index: number, name: string): Promise<void> {
    const updated = presets.map((p, i) => (i === index ? { ...p, name } : p))
    setPresets(updated)
    await settingsApi.set({ sortPresets: updated })
  }

  useEffect(() => {
    if (!isSorting) return
    const unsub = sortApi.onProgress((p) => setProgress(p))
    return unsub
  }, [isSorting, setProgress])

  const previewRef = useRef<HTMLDivElement>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const selectedFile = classified.find((f) => f.path === selectedPath) ?? null

  function handleDrop(result: DropResult): void {
    setClassified([])
    setFiles([])
    setStatus('idle')
    setError(null)
    setSelectedPath(null)

    if (result.folders.length > 0) {
      // Use the first folder as the source and output (sort in-place)
      setSourceFolder(result.folders[0])
      setOutputFolder(result.folders[0])
      setMode('move')
      setDroppedFiles([])
    } else if (result.files.length > 0) {
      // Individual files dropped — store paths, use parent as source label
      const sep = result.files[0].includes('\\') ? '\\' : '/'
      const parentDir = result.files[0].split(sep).slice(0, -1).join(sep)
      setSourceFolder(parentDir)
      setOutputFolder(parentDir)
      setMode('move')
      setDroppedFiles(result.files)
    }
  }

  async function handleSelectSource(): Promise<void> {
    const path = await folderApi.select()
    if (path) {
      setIncludeSubfolders(false)
      setSourceFolder(path)
      setOutputFolder(path)
      setMode('move')
      // Reset downstream state when source changes
      setClassified([])
      setFiles([])
      setStatus('idle')
      setError(null)
      setSelectedPath(null)
    }
  }

  async function handleScanAndPreview(deep = includeSubfolders): Promise<void> {
    if (!sourceFolder) return
    try {
      setError(null)
      clearApprovedRenames()
      setDuplicates([])
      setFocus('all')
      setNestedFileCount(0)
      setEmptyFolders([])
      setSealedFolders([])
      setSortSummary(null)
      setClassified([])
      setSelectedPath(null)
      setStatus('scanning')
      setScanPhase('scanning')
      scanStartedAt.current = Date.now()

      let scanned: FileEntry[]
      if (droppedFiles.length > 0) {
        scanned = await folderApi.scanFiles(droppedFiles)
        setSealedFolders([])
      } else {
        // Sort-scoped scan: only loose root files — subfolders stay sealed
        // so projects and app folders can't be scattered
        const scanResult = await folderApi.scanForSort(sourceFolder, { includeSubfolders: deep })
        scanned = scanResult.files
        setSealedFolders(scanResult.sealedFolders)
        setNestedFileCount(scanResult.nestedFileCount)
      }
      setFiles(scanned)

      setScanPhase('classifying')
      setClassifyProgress(null)
      setLastElapsedMs(null)
      setLastSorterUsed(null)
      const unsubscribe = sortApi.onClassifyProgress((progress) => {
        setClassifyProgress(progress)
        if (progress.phase === 'extracting') setScanPhase('extracting')
        if (progress.phase === 'classifying-ai') {
          setScanPhase('classifying-ai')
        }
        if (progress.phase === 'done') {
          if (progress.elapsedMs) setLastElapsedMs(progress.elapsedMs)
          setLastSorterUsed(progress.sorter ?? null)
        }
      })
      try {
        const preview = await sortApi.preview(scanned)
        setClassified(preview)
        setStatus('previewing')
        setScanPhase('idle')

        // Bring the results into view — the preview lives below the fold
        requestAnimationFrame(() =>
          previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        )

        // Detect duplicates and empty folders in the background
        const dupes = await sortApi.detectDuplicates(
          preview.map((f) => ({ path: f.path, size: f.size }))
        )
        setDuplicates(dupes)

        // Detect empty folders in the source directory
        if (sourceFolder && mode === 'move') {
          const empty = await sortApi.detectEmptyFolders(sourceFolder)
          setEmptyFolders(empty)
        }
      } finally {
        unsubscribe()
        setClassifyProgress(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
      setStatus('error')
      setScanPhase('idle')
    }
  }

  // Choosing a folder IS the instruction. Making the owner press a second
  // button left them looking at a page with nothing on it.
  useEffect(() => {
    if (status !== 'idle') return
    if (!sourceFolder && droppedFiles.length === 0) return
    handleScanAndPreview()
  }, [sourceFolder, droppedFiles, status]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSort(): Promise<void> {
    if (!outputFolder || classified.length === 0) return
    try {
      setError(null)
      setStatus('sorting')
      const renames = Object.keys(approvedRenames).length > 0 ? approvedRenames : undefined
      const batch = await sortApi.execute(classified, outputFolder, mode, renames)
      setBatchId(batch.batchId)
      setStatus('done')
      setProgress(null)

      // Compute sort summary from batch operations
      const categories = new Set(batch.operations.map((op) => op.category).filter(Boolean))
      const renamed = batch.operations.filter(
        (op) => op.newName && op.newName !== op.originalName
      ).length
      setSortSummary({
        totalFiles: batch.totalFiles,
        categories: categories.size,
        renamed,
        emptyFoldersCleaned: mode === 'move' ? emptyFolders.length : 0
      })

      // Always offer a one-click undo right after sorting
      toast.success(
        `${t('sort.sorted')}${batch.totalFiles} ${batch.totalFiles === 1 ? t('sort.file') : t('sort.files')}`,
        {
          duration: 8000,
          action: {
            label: t('history.undo'),
            onClick: async () => {
              announceUndo(await sortApi.undo(batch.batchId), t)
            }
          }
        }
      )

      // Check for first-sort celebration
      const settings = await settingsApi.get()
      if (!settings.hasCompletedFirstSort) {
        await settingsApi.set({ hasCompletedFirstSort: true })
        toast.success(t('sort.firstSortCongrats'), { duration: 5000 })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sort failed'
      setError(msg)
      setStatus('error')
      toast.error(msg)
    }
  }

  async function handleRemoveDuplicates(pathsToRemove: string[]): Promise<void> {
    if (pathsToRemove.length === 0) return
    try {
      const result = await sortApi.trashFiles(pathsToRemove)
      const removedSet = new Set(pathsToRemove)
      setClassified(classified.filter((f) => !removedSet.has(f.path)))
      // Drop removed paths from groups; a group with one file left is no longer a duplicate
      const remaining = duplicates
        .map((g) => ({ ...g, paths: g.paths.filter((p) => !removedSet.has(p)) }))
        .filter((g) => g.paths.length > 1)
      setDuplicates(remaining)
      if (remaining.length === 0) setFocus('all')
      toast.success(`Moved ${result.trashed} duplicate${result.trashed !== 1 ? 's' : ''} to trash`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove duplicates')
    }
  }

  function handleReset(): void {
    reset()
    setEmptyFolders([])
    setSortSummary(null)
    setSelectedPath(null)
  }

  async function handleCorrection(params: {
    filePath: string
    category: string
    subcategory: string | null
  }): Promise<void> {
    const { filePath, category, subcategory } = params
    const index = classified.findIndex((f) => f.path === filePath)
    const file = classified[index]
    if (!file) return
    const next = [...classified]
    next[index] = {
      ...file,
      classification: {
        ...file.classification,
        category: category as ClassifiedFile['classification']['category'],
        subcategory,
        confidence: 1,
        semanticPath: subcategory ? [category, subcategory] : [category]
      }
    }
    setClassified(next)
    // Remember the correction under the file's fingerprint — never expires
    await sortApi.correctClassification({ filePath, category, subcategory })
    toast.success(t('sort.correctionSaved'))
  }

  return (
    <DropZone onDrop={handleDrop} disabled={isSorting}>
      <div className="flex h-full flex-col">
        <PageHeader
          title={t('sort.title')}
          actions={
            showEmpty ? undefined : (
              <>
                {status === 'done' && (
                  <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
                    <ArrowDownUp className="h-3.5 w-3.5" />
                    {t('sort.startOver')}
                  </Button>
                )}
                {(canScan || isScanning) && status !== 'done' && (
                  <Button
                    size="sm"
                    variant={status === 'previewing' ? 'outline' : 'default'}
                    disabled={!canScan || isScanning || isSorting}
                    onClick={() => handleScanAndPreview()}
                    className="gap-1.5"
                  >
                    {isScanning ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    {isScanning ? t(PHASE_LABELS[scanPhase]) : t('sort.scanPreview')}
                  </Button>
                )}
                {/* Sort only becomes available once there is a plan to confirm */}
                {(status === 'previewing' || isSorting) && classified.length > 0 && (
                  <Button
                    size="sm"
                    disabled={!canSort && !isSorting}
                    onClick={handleSort}
                    className="gap-1.5"
                  >
                    {isSorting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArrowDownUp className="h-3.5 w-3.5" />
                    )}
                    {isSorting ? t('sort.sorting') : t('sort.sortNow')}
                  </Button>
                )}
              </>
            )
          }
        />

        {showEmpty ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <FolderOpen className="size-6 text-muted-foreground" />
            </div>
            <div className="max-w-sm text-center">
              <p className="text-sm font-semibold text-foreground">{t('sort.emptyTitle')}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {t('sort.emptyDesc')}
              </p>
            </div>
            <Button onClick={handleSelectSource} className="gap-2">
              <FolderOpen className="size-4" />
              {t('sort.chooseFolder')}
            </Button>
            <p className="text-[10px] text-muted-foreground/60">{t('sort.emptyNote')}</p>
          </div>
        ) : foundNothing ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <FolderMinus className="size-6 text-muted-foreground" />
            </div>
            <div className="max-w-sm text-center">
              <p className="text-sm font-semibold text-foreground">{t('sort.nothingToSort')}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {nestedFileCount > 0 ? t('sort.nothingToSortDeep') : t('sort.nothingToSortDesc')}
              </p>
            </div>
            {nestedFileCount > 0 && (
              <LookInsideButton
                folders={plainSealedCount}
                files={nestedFileCount}
                onClick={lookInside}
                variant="default"
              />
            )}
            <Button variant="outline" onClick={handleSelectSource} className="gap-2">
              <FolderOpen className="size-4" />
              {t('sort.pickAnother')}
            </Button>
            {sealedFolders.length > 0 && (
              <p className="text-[10px] text-muted-foreground/60">
                {t('sort.nothingToSortSealed').replace('{count}', String(sealedFolders.length))}
              </p>
            )}
          </div>
        ) : showScanPanel ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <ScanSearch className="size-6 animate-pulse text-primary" />
            </div>
            <div className="w-full max-w-sm space-y-3 text-center">
              <p className="text-sm font-semibold text-foreground">{t(PHASE_LABELS[scanPhase])}</p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                {classifyProgress && classifyProgress.total > 0 ? (
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-200 ease-linear"
                    style={{ width: `${Math.round(smoothProgress)}%` }}
                  />
                ) : (
                  <div className="h-full w-1/3 rounded-full bg-primary/60 animate-[slide_1.5s_ease-in-out_infinite]" />
                )}
              </div>
              {classifyProgress && classifyProgress.total > 0 && (
                <p className="text-xs tabular-nums text-muted-foreground">
                  {smoothCount}/{classifyProgress.total}
                  {timeLeft && ` \u00b7 ${t('sort.aboutLeft').replace('{time}', timeLeft)}`}
                </p>
              )}
              <p className="truncate text-[11px] text-muted-foreground/70">
                {stalled && currentFileName
                  ? t('sort.stillWorking').replace('{name}', currentFileName)
                  : currentFileName || classifyProgress?.currentFile || t('sort.readingFiles')}
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto p-6">
            <div className="space-y-4">
              {/* Presets */}
              <PresetBar
                presets={presets}
                disabled={isSorting}
                onLoad={handleLoadPreset}
                onRename={handleRenamePreset}
                onDelete={handleDeletePreset}
              />

              {/* What is being sorted, and how — one slim line, not a card */}
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span
                  className="min-w-0 truncate font-medium text-foreground"
                  title={sourceFolder ?? ''}
                >
                  {sourceFolder}
                </span>
                {droppedFiles.length > 0 && (
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {droppedFiles.length}{' '}
                    {droppedFiles.length !== 1 ? t('sort.files') : t('sort.file')}
                  </span>
                )}
                {!isSorting && (
                  <button
                    onClick={handleSelectSource}
                    className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    {t('sort.changeFolder')}
                  </button>
                )}

                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {canScan && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={openSavePresetDialog}
                          className="gap-1.5"
                        >
                          <Save className="h-3.5 w-3.5" />
                          {t('sort.savePreset')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('sort.savePresetTooltip')}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Save Preset Dialog */}
              {showSavePreset && (
                <Card className="shadow-sm">
                  <CardContent className="flex items-center gap-3">
                    <Save className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSavePreset()
                        if (e.key === 'Escape') setShowSavePreset(false)
                      }}
                      placeholder={t('sort.presetName')}
                      className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleSavePreset} disabled={!presetName.trim()}>
                      {t('common.save')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowSavePreset(false)}>
                      {t('common.cancel')}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive-subtle px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Progress Bar */}
              {isSorting && progress && (
                <Card className="shadow-sm">
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground truncate max-w-[50%] sm:max-w-[60%]">
                        {progress.fileName}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {progress.current} / {progress.total}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                        style={{
                          width: `${(progress.current / progress.total) * 100}%`
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {status === 'done' && (
                <SortSummaryCard
                  fileCount={classified.length}
                  summary={sortSummary}
                  onViewHistory={() => navigateTo('history')}
                  onStartOver={handleReset}
                />
              )}

              {/* File Preview — master-detail: virtualized tree + classification detail */}
              {classified.length > 0 && status !== 'done' && (
                <Card
                  ref={previewRef}
                  className={cn(
                    'shadow-sm transition-opacity scroll-mt-4',
                    isSorting && 'opacity-60'
                  )}
                >
                  <CardContent className="p-0">
                    <div className="px-6 py-3 border-b border-border">
                      <div className="flex items-start justify-between gap-3">
                        {/* The whole plan in one line: what happens, and how many times */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]">
                          <span className="font-medium text-foreground">
                            {classified.length}{' '}
                            {classified.length !== 1 ? t('sort.files') : t('sort.file')}{' '}
                            {t('sort.planInto').replace('{count}', String(folderCount))}
                          </span>
                          {renameCount > 0 && (
                            <PlanCount
                              active={focus === 'renames'}
                              onClick={() => setFocus(focus === 'renames' ? 'all' : 'renames')}
                            >
                              <Pencil className="h-3 w-3" />
                              {t('sort.planRenamed').replace('{count}', String(renameCount))}
                            </PlanCount>
                          )}
                          {duplicates.length > 0 && (
                            <PlanCount
                              warn
                              active={focus === 'duplicates'}
                              onClick={() =>
                                setFocus(focus === 'duplicates' ? 'all' : 'duplicates')
                              }
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {t('sort.planDuplicates').replace(
                                '{count}',
                                String(duplicatePaths.size)
                              )}
                            </PlanCount>
                          )}
                          {focus !== 'all' && (
                            <button
                              onClick={() => setFocus('all')}
                              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            >
                              {t('sort.planShowAll')}
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setClassified([])
                            setFiles([])
                            setStatus('idle')
                            clearApprovedRenames()
                            setSelectedPath(null)
                            setFocus('all')
                          }}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          title="Clear preview"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {/* Footnotes: untouched things, spelled out instead of hidden in a tooltip */}
                      {planFootnotes.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {planFootnotes.join(' · ')}
                        </p>
                      )}
                      {nestedFileCount > 0 && (
                        <div className="mt-2">
                          <LookInsideButton
                            folders={plainSealedCount}
                            files={nestedFileCount}
                            onClick={lookInside}
                          />
                        </div>
                      )}
                      {showClaudeOffer && (
                        <ClaudeOffer count={classified.length} onAccept={handleTakeClaudeOffer} />
                      )}
                      {fallbackNotice && (
                        <p className="mt-2 text-xs text-muted-foreground">{fallbackNotice}</p>
                      )}
                    </div>

                    <ResizablePanelGroup orientation="horizontal" className="h-[420px]">
                      <ResizablePanel defaultSize={60} minSize={30}>
                        <PreviewTree
                          files={classified}
                          selectedPath={selectedPath}
                          onSelect={setSelectedPath}
                          filterPaths={filterPaths}
                        />
                      </ResizablePanel>
                      <ResizableHandle />
                      <ResizablePanel defaultSize={40} minSize={25}>
                        {focus === 'renames' ? (
                          <RenamePanel
                            classified={classified}
                            approvedRenames={approvedRenames}
                            onApprove={setApprovedRename}
                            rejectedRenames={rejectedRenames}
                            onReject={rejectRename}
                            onApproveAll={() => {
                              const renames: Record<string, string> = {}
                              for (const f of classified) {
                                if (
                                  f.classification.suggestedName &&
                                  !rejectedRenames.has(f.path)
                                ) {
                                  renames[f.path] = f.classification.suggestedName
                                }
                              }
                              approveAllRenames(renames)
                            }}
                            onRejectAll={() => {
                              rejectAllRenames()
                              setFocus('all')
                            }}
                            onClose={() => setFocus('all')}
                          />
                        ) : focus === 'duplicates' ? (
                          <DuplicatesCard
                            duplicates={duplicates}
                            classified={classified}
                            onRemoveDuplicates={handleRemoveDuplicates}
                            onDismiss={() => setFocus('all')}
                          />
                        ) : selectedFile ? (
                          <ClassificationDetail
                            key={selectedFile.path}
                            file={selectedFile}
                            onCorrect={handleCorrection}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <EmptyState icon={FileSearch} title={t('sort.selectFile')} />
                          </div>
                        )}
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </DropZone>
  )
}
