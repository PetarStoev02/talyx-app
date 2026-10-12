import { useEffect, useRef, useState } from 'react'
import {
  Search,
  Send,
  Sparkles,
  HardDrive,
  ScanSearch,
  Pause,
  Play,
  XCircle,
  FileSearch
} from 'lucide-react'
import { Button } from '@shared/ui/button'
import { PageHeader } from '@shared/ui/page-header'
import { EmptyState } from '@shared/ui/empty-state'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@shared/ui/resizable'
import { useSearch, type ChatMessage } from '@app/providers/useSearch'
import { searchApi, folderApi, type SearchResult, type FilePreviewResult } from '@shared/api/ipc'
import { ChatBubble } from '@features/ai-search/ChatBubble'
import { FileResultCard } from '@features/ai-search/FileResultCard'
import { FilePreview } from '@features/file-preview/FilePreview'
import { cn } from '@shared/lib/utils'
import { useLanguage } from '@app/providers/useLanguage'

const METADATA_ONLY_PREVIEW: NonNullable<FilePreviewResult['preview']> = {
  type: 'metadata',
  content: ''
}

export function SearchPage(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const {
    scanStatus,
    scanProgress,
    scanTotal,
    scanCurrent,
    scanCancelled,
    scanPaused,
    messages,
    loading,
    stats,
    setScanStatus,
    setScanProgress,
    pauseScan,
    resumeScan,
    cancelScan,
    addMessage,
    setLoading,
    setStats
  } = useSearch()

  const [input, setInput] = useState('')
  const [selectedFile, setSelectedFile] = useState<SearchResult | null>(null)
  const [preview, setPreview] = useState<FilePreviewResult['preview'] | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef(false)
  const pauseRef = useRef(false)

  // Keep refs in sync with store
  useEffect(() => {
    cancelRef.current = scanCancelled
  }, [scanCancelled])

  useEffect(() => {
    pauseRef.current = scanPaused
  }, [scanPaused])

  useEffect(() => {
    searchApi
      .stats()
      .then((s) => {
        setStats(s)
        if (s.indexedFiles > 0) setScanStatus('complete')
      })
      .catch(() => {})
  }, [setStats, setScanStatus])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  async function handleStartScan(): Promise<void> {
    cancelRef.current = false
    const home = await folderApi.home()
    await runScan(home)
  }

  async function runScan(folder: string): Promise<void> {
    setScanStatus('scanning')
    setScanProgress(0, 0, t('search.discoveringFiles'))

    const restoreStatus = (): void => {
      const indexed = useSearch.getState().stats?.indexedFiles ?? 0
      setScanStatus(indexed > 0 ? 'complete' : 'none')
    }

    try {
      const files = await folderApi.scan(folder)
      if (files.length === 0 || cancelRef.current) {
        restoreStatus()
        return
      }

      const total = files.length
      setScanProgress(0, total, t('search.startingDeepScan'))

      // Listen for real-time progress from the backend
      const cleanupProgress = searchApi.onScanProgress((progress) => {
        if (cancelRef.current) return
        setScanProgress(progress.current, progress.total, progress.currentFile)
      })

      try {
        // Deep scan: text out of documents, filename + category for everything else
        await searchApi.deepScan(files.map((f) => ({ path: f.path, name: f.name })))
      } finally {
        cleanupProgress()
      }

      if (cancelRef.current) {
        restoreStatus()
        return
      }

      const finalStats = await searchApi.stats()
      setStats(finalStats)
      setScanStatus(finalStats.indexedFiles > 0 ? 'complete' : 'none')
    } catch {
      restoreStatus()
    }
  }

  async function handleSend(): Promise<void> {
    const query = input.trim()
    if (!query || loading) return

    setInput('')

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now()
    }
    addMessage(userMsg)
    setLoading(true)

    try {
      const results = await searchApi.query(query, { limit: 10 })
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content:
          results.length > 0
            ? t('search.foundFiles').replace('{count}', String(results.length))
            : t('search.noFilesFound'),
        results: results.length > 0 ? results : undefined,
        timestamp: Date.now()
      }
      addMessage(assistantMsg)
    } catch {
      addMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: t('search.searchFailed'),
        timestamp: Date.now()
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectResult(result: SearchResult): Promise<void> {
    setSelectedFile(result)
    setPreview(null)
    try {
      const response = await searchApi.filePreview(result.filePath)
      setPreview(response.success && response.preview ? response.preview : METADATA_ONLY_PREVIEW)
    } catch {
      setPreview(METADATA_ONLY_PREVIEW)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isEmpty = messages.length === 0
  const scanPercent = scanTotal > 0 ? Math.round((scanProgress / scanTotal) * 100) : 0
  const hasIndex = (stats?.indexedFiles ?? 0) > 0
  const isReady = hasIndex || scanStatus === 'complete'
  const isScanning = scanStatus === 'scanning' || scanStatus === 'paused'

  const inputBar = (
    <div className="border-t border-border px-6 py-3">
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border bg-background px-3 py-2',
          'border-border focus-within:border-ring focus-within:ring-1 focus-within:ring-ring'
        )}
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('search.askPlaceholder')}
          disabled={loading}
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="h-7 w-7 p-0"
        >
          <Send className="size-3.5" />
        </Button>
      </div>
    </div>
  )

  const transcript = (
    <div className="flex flex-col gap-4 px-6 py-4">
      {messages.map((msg) => (
        <div key={msg.id}>
          <ChatBubble message={msg} />
          {msg.results && msg.results.length > 0 && (
            <div className="ml-9 mt-2 space-y-1.5">
              {msg.results.map((result, i) => (
                <div
                  key={result.filePath}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                  style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}
                >
                  <FileResultCard
                    result={result}
                    selected={selectedFile?.filePath === result.filePath}
                    onSelect={handleSelectResult}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {loading && (
        <div className="flex items-start gap-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="size-3.5 animate-pulse text-primary" />
          </div>
          <div className="mt-0.5">
            <p className="text-xs font-medium text-muted-foreground">{t('search.talyxAi')}</p>
            <div className="mt-1.5 flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('search.title')}
        actions={
          isScanning ? undefined : (
            <div className="flex items-center gap-2">
              {stats && stats.indexedFiles > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {t('search.filesIndexed').replace('{count}', String(stats.indexedFiles))}
                </span>
              )}
              {/* Sorting seeds the index, so the page can be "ready" on a handful of
                  files. Scanning the rest of the computer has to stay one click away. */}
              {scanStatus !== 'none' && (
                <Button size="sm" variant="ghost" onClick={handleStartScan} className="gap-1.5">
                  <ScanSearch className="size-3.5" />
                  {t('search.scanMyComputer')}
                </Button>
              )}
            </div>
          )
        }
      />

      {/* Scan required */}
      {scanStatus === 'none' && (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <HardDrive className="size-6 text-muted-foreground" />
          </div>
          <div className="max-w-sm text-center">
            <p className="text-sm font-semibold text-foreground">{t('search.scanFirst')}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t('search.scanFirstDesc')}
            </p>
          </div>
          <Button onClick={handleStartScan} className="gap-2">
            <ScanSearch className="size-4" />
            {t('search.scanMyComputer')}
          </Button>
          <p className="text-[10px] text-muted-foreground/60">{t('search.offlineNote')}</p>
        </div>
      )}

      {/* Scanning / Paused */}
      {isScanning && (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
            <ScanSearch
              className={cn('size-6 text-primary', scanStatus === 'scanning' && 'animate-pulse')}
            />
          </div>
          <div className="w-full max-w-sm space-y-3 text-center">
            <p className="text-sm font-semibold text-foreground">
              {scanStatus === 'paused' ? t('search.scanPaused') : t('search.scanning')}
            </p>

            {/* Progress */}
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${scanPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {scanProgress.toLocaleString()} / {scanTotal.toLocaleString()} {t('search.files')}
                </span>
                <span className="tabular-nums">{scanPercent}%</span>
              </div>
            </div>

            {scanCurrent && (
              <p className="truncate text-xs text-muted-foreground/70">{scanCurrent}</p>
            )}

            {/* Pause / Resume / Cancel buttons */}
            <div className="flex justify-center gap-2 pt-1">
              {scanStatus === 'scanning' ? (
                <Button variant="outline" size="sm" onClick={pauseScan} className="gap-1.5 text-xs">
                  <Pause className="size-3" />
                  {t('search.pause')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resumeScan}
                  className="gap-1.5 text-xs"
                >
                  <Play className="size-3" />
                  {t('search.resume')}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelScan}
                className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
              >
                <XCircle className="size-3" />
                {t('search.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Ready — empty chat */}
      {isReady && isEmpty && (
        <>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Sparkles className="size-5 text-muted-foreground" />
            </div>
            <div className="max-w-sm text-center">
              <p className="text-sm font-medium text-foreground">{t('search.searchYourFiles')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('search.describeSearch')}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {[t('search.suggestion1'), t('search.suggestion2'), t('search.suggestion3')].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion)
                      inputRef.current?.focus()
                    }}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                )
              )}
            </div>
          </div>
          {inputBar}
        </>
      )}

      {/* Ready — results ↔ preview split */}
      {isReady && !isEmpty && (
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel defaultSize={55} minSize={30}>
            <div className="flex h-full flex-col">
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                {transcript}
              </div>
              {inputBar}
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={45} minSize={25}>
            {selectedFile ? (
              <FilePreview
                preview={preview ?? METADATA_ONLY_PREVIEW}
                file={{
                  fileName: selectedFile.fileName,
                  filePath: selectedFile.filePath,
                  category: selectedFile.category,
                  subcategory: selectedFile.subcategory
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <EmptyState icon={FileSearch} title={t('search.selectResult')} />
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  )
}
