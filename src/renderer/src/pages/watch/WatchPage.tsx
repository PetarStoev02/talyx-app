import { useState, useEffect } from 'react'
import { Eye, Plus, FolderOpen } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { ScrollArea } from '@shared/ui/scroll-area'
import { PageHeader } from '@shared/ui/page-header'
import { EmptyState } from '@shared/ui/empty-state'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@shared/ui/resizable'
import { cn } from '@shared/lib/utils'
import { useLanguage } from '@app/providers/useLanguage'
import { useWatchFolders } from '@app/providers/useWatchFolders'
import { folderApi, watchApi, sortApi, settingsApi, type WatchFolder } from '@shared/api/ipc'
import { toast } from 'sonner'
import { WatchFolderDetail, type TimestampedEvent } from './WatchFolderDetail'

const MAX_EVENTS = 50

function basename(p: string): string {
  return p.split('/').pop() || p
}

export function WatchPage(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const { folders, loading, setFolders, addFolder, removeFolder, toggleFolder, setLoading } =
    useWatchFolders()
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [events, setEvents] = useState<TimestampedEvent[]>([])

  useEffect(() => {
    setLoading(true)
    watchApi
      .list()
      .then((list) => {
        setFolders(list)
      })
      .finally(() => setLoading(false))
  }, [setFolders, setLoading])

  useEffect(() => {
    if (folders.length === 0) {
      setSelectedId(null)
      return
    }
    if (selectedId === null || !folders.some((f) => f.id === selectedId)) {
      setSelectedId(folders[0].id)
    }
  }, [folders, selectedId])

  useEffect(() => {
    if (folders.length === 0) return
    const folderPaths = folders.map((f) => f.path)

    sortApi
      .getHistory(100, 0)
      .then((batches) => {
        const historicalEvents: TimestampedEvent[] = batches.flatMap((batch) =>
          batch.operations
            .filter((op) => folderPaths.some((fp) => op.sourcePath.startsWith(fp)))
            .map((op) => ({
              type: 'file-sorted' as const,
              folderPath: folderPaths.find((fp) => op.sourcePath.startsWith(fp)) ?? '',
              filePath: op.destPath,
              category: op.category ?? undefined,
              timestamp: new Date(batch.timestamp).getTime()
            }))
        )

        setEvents((prev) => {
          const combined = [...prev, ...historicalEvents]
          const seen = new Set<string>()
          return combined
            .filter((e) => {
              const key = `${e.filePath}-${e.timestamp}`
              if (seen.has(key)) return false
              seen.add(key)
              return true
            })
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, MAX_EVENTS)
        })
      })
      .catch(() => {})
  }, [folders])

  useEffect(() => {
    const unsub = watchApi.onEvent((event) => {
      const timestamped: TimestampedEvent = { ...event, timestamp: Date.now() }
      setEvents((prev) => [timestamped, ...prev].slice(0, MAX_EVENTS))
      if (event.type === 'file-sorted') {
        const fileName = event.filePath.split('/').pop() ?? event.filePath
        toast.success(`${t('watch.sorted')}${fileName} → ${event.category}`)
      } else if (event.type === 'error') {
        toast.error(event.error ?? t('watch.error'))
      }
    })
    return unsub
  }, [t])

  async function handleAdd(): Promise<void> {
    const watchPath = await folderApi.select()
    if (!watchPath) return

    const outputPath = await folderApi.select()
    if (!outputPath) return

    setAdding(true)
    try {
      const settings = await settingsApi.get()
      const folder = await watchApi.add(watchPath, outputPath, settings.defaultSortMode ?? 'move')
      addFolder(folder)
      setSelectedId(folder.id)
      toast.success(t('watch.added'))
    } catch {
      toast.error(t('watch.addFailed'))
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(id: number): Promise<void> {
    if (removing === id) {
      try {
        await watchApi.remove(id)
        removeFolder(id)
        toast.success(t('watch.removed'))
      } catch {
        toast.error(t('watch.removeFailed'))
      } finally {
        setRemoving(null)
      }
    } else {
      setRemoving(id)
      setTimeout(() => setRemoving(null), 3000)
    }
  }

  async function handleToggle(id: number, enabled: boolean): Promise<void> {
    try {
      await watchApi.toggle(id, enabled)
      toggleFolder(id, enabled)
    } catch {
      toast.error(t('watch.toggleFailed'))
    }
  }

  async function handleToggleSortMode(folder: WatchFolder): Promise<void> {
    const newMode = folder.sortMode === 'copy' ? 'move' : 'copy'
    try {
      await watchApi.setMode(folder.id, newMode)
      setFolders(folders.map((f) => (f.id === folder.id ? { ...f, sortMode: newMode } : f)))
      toast.success(newMode === 'move' ? t('sort.move') : t('sort.copy'))
    } catch {
      toast.error(t('watch.modeFailed'))
    }
  }

  const selected = folders.find((f) => f.id === selectedId) ?? null
  const folderEvents = selected
    ? events.filter((e) => e.folderPath === selected.path || e.filePath.startsWith(selected.path))
    : []

  const addButton = (
    <Button size="sm" onClick={() => void handleAdd()} disabled={adding} className="gap-1.5">
      <Plus className="size-3.5" />
      {adding ? t('watch.adding') : t('watch.addFolder')}
    </Button>
  )

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={t('watch.title')} />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
          <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">{t('watch.loading')}</p>
        </div>
      </div>
    )
  }

  if (folders.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={t('watch.title')} />
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            icon={Eye}
            title={t('watch.noWatchFolders')}
            description={t('watch.noWatchFoldersDesc')}
            action={addButton}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t('watch.title')} actions={addButton} />

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={38} minSize={25}>
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-0.5 p-2">
              {folders.map((folder) => {
                const isSelected = folder.id === selectedId
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setSelectedId(folder.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                      isSelected ? 'bg-accent' : 'hover:bg-accent/50',
                      !folder.enabled && 'opacity-60'
                    )}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <FolderOpen className="size-3.5 text-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {basename(folder.path)}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{folder.path}</p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                        folder.enabled
                          ? 'bg-muted text-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {folder.enabled ? t('watch.enabled') : t('watch.paused')}
                    </span>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize={62} minSize={35}>
          {selected ? (
            <WatchFolderDetail
              folder={selected}
              events={folderEvents}
              removing={removing === selected.id}
              onToggle={() => void handleToggle(selected.id, !selected.enabled)}
              onToggleSortMode={() => void handleToggleSortMode(selected)}
              onRemove={() => void handleRemove(selected.id)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <EmptyState icon={Eye} title={t('watch.selectFolder')} />
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
