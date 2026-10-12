import { useEffect, useState } from 'react'
import { ChevronRight, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@shared/lib/utils'
import { useNavigation } from '@app/providers/useNavigation'
import { useLanguage } from '@app/providers/useLanguage'
import { useHistory } from '@app/providers/useHistory'
import { useSortSession } from '@app/providers/useSortSession'
import { sortApi } from '@shared/api/ipc'
import { announceUndo } from '@shared/lib/undoToast'
import { deriveRecentSorts } from './deriveRecentSorts'

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  return `${diffDays}d`
}

export function RecentSorts(): React.JSX.Element {
  const navigate = useNavigation((s) => s.navigate)
  const currentView = useNavigation((s) => s.currentView)
  const t = useLanguage((s) => s.t)
  const batches = useHistory((s) => s.batches)
  const setBatches = useHistory((s) => s.setBatches)
  const markBatchUndone = useHistory((s) => s.markBatchUndone)
  const selectBatch = useHistory((s) => s.selectBatch)
  const lastSortBatchId = useSortSession((s) => s.batchId)
  const [open, setOpen] = useState(true)
  const [loaded, setLoaded] = useState(false)

  // Load history into the shared store (single source with HistoryPage — idempotent).
  // Refetch on view change and whenever a sort completes so the list stays current.
  useEffect(() => {
    sortApi
      .getHistory(50, 0)
      .then((fetched) => {
        setBatches(fetched)
        setLoaded(true)
      })
      .catch(() => {})
  }, [setBatches, currentView, lastSortBatchId])

  const rows = deriveRecentSorts(batches)

  function openHistory(): void {
    selectBatch(null)
    navigate('history')
  }

  function openBatchInHistory(batchId: string): void {
    selectBatch(batchId)
    navigate('history')
  }

  async function handleUndo(batchId: string): Promise<void> {
    try {
      if (announceUndo(await sortApi.undo(batchId), t)) markBatchUndone(batchId)
    } catch {
      toast.error(t('sort.undoFailed'))
    }
  }

  return (
    <div className="mt-1.5 flex min-h-0 flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-7 items-center gap-2 rounded-md px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80 transition-colors hover:bg-accent/40 hover:text-foreground"
      >
        <ChevronRight
          className={cn('size-3 shrink-0 transition-transform duration-150', open && 'rotate-90')}
        />
        {t('sidebar.recentSorts')}
      </button>
      {open && loaded && rows.length === 0 && (
        <div className="ml-2 flex flex-col gap-1 border-l border-border/40 py-1 pl-2">
          <p className="px-2 text-[12px] text-muted-foreground/70">{t('sidebar.noRecentSorts')}</p>
          <button
            type="button"
            onClick={() => navigate('sort')}
            className="flex h-7 items-center rounded-md px-2 text-[12px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            {t('sidebar.sortFirstFolder')}
          </button>
        </div>
      )}
      {open && rows.length > 0 && (
        <div className="ml-2 flex flex-col gap-0.5 border-l border-border/40 pl-2">
          {rows.map((row) => (
            <div
              key={row.batchId}
              role="button"
              tabIndex={0}
              onClick={() => openBatchInHistory(row.batchId)}
              onKeyDown={(e) => e.key === 'Enter' && openBatchInHistory(row.batchId)}
              className={cn(
                'group flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 text-[12px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground',
                row.undoneAt !== null && 'opacity-50'
              )}
            >
              <span className="min-w-0 flex-1 truncate text-left">{row.label}</span>
              {row.undoneAt === null ? (
                <>
                  <span className="text-[11px] tabular-nums text-muted-foreground/70 group-hover:hidden">
                    {row.fileCount} · {formatRelativeTime(row.timestamp)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleUndo(row.batchId)
                    }}
                    aria-label={t('history.undo')}
                    className="hidden size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground group-hover:flex"
                  >
                    <Undo2 className="size-3.5" />
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-muted-foreground">{t('history.undone')}</span>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={openHistory}
            className="flex h-7 items-center rounded-md px-2 text-[12px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            {t('sidebar.seeAllHistory')}
          </button>
        </div>
      )}
    </div>
  )
}
