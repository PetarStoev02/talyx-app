import { useState, useEffect } from 'react'
import { Clock, Undo2, Trash2, Copy, Scissors, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@shared/ui/button'
import { ScrollArea } from '@shared/ui/scroll-area'
import { PageHeader } from '@shared/ui/page-header'
import { EmptyState } from '@shared/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@shared/ui/dialog'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@shared/ui/resizable'
import { cn } from '@shared/lib/utils'
import { useLanguage } from '@app/providers/useLanguage'
import { useHistory } from '@app/providers/useHistory'
import { useNavigation } from '@app/providers/useNavigation'
import { sortApi } from '@shared/api/ipc'
import { announceUndo } from '@shared/lib/undoToast'
import { BatchDetail } from './BatchDetail'
import { formatTimestamp } from './format'

export function HistoryPage(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const {
    batches,
    loading,
    undoing,
    selectedBatchId,
    setBatches,
    setLoading,
    setUndoing,
    selectBatch,
    removeBatch,
    markBatchUndone
  } = useHistory()
  const [confirmingUndo, setConfirmingUndo] = useState(false)
  const navigate = useNavigation((s) => s.navigate)

  useEffect(() => {
    setLoading(true)
    sortApi
      .getHistory(50, 0)
      .then((result) => setBatches(result))
      .catch(() => setBatches([]))
      .finally(() => setLoading(false))
  }, [setBatches, setLoading])

  const selected = batches.find((b) => b.batchId === selectedBatchId) ?? null

  // Auto-select the newest batch when nothing (or a removed batch) is selected
  useEffect(() => {
    if (!selected && batches.length > 0) {
      selectBatch(batches[0].batchId)
    }
  }, [selected, batches, selectBatch])

  const handleUndoConfirm = async (): Promise<void> => {
    if (!selected) return
    const batchId = selected.batchId
    setConfirmingUndo(false)
    setUndoing(batchId)

    try {
      // The batch stays in history as an audit trail, marked undone
      if (announceUndo(await sortApi.undo(batchId), t)) markBatchUndone(batchId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Undo failed')
    } finally {
      setUndoing(null)
    }
  }

  const handleDeleteBatch = async (batchId: string): Promise<void> => {
    try {
      await sortApi.deleteBatch(batchId)
      removeBatch(batchId)
      if (batchId === selectedBatchId) selectBatch(null)
      toast.success(t('common.delete'))
    } catch {
      toast.error('Delete failed')
    }
  }

  const handleClearAll = async (): Promise<void> => {
    try {
      await sortApi.clearHistory()
      setBatches([])
      selectBatch(null)
      toast.success(t('common.delete'))
    } catch {
      toast.error('Clear failed')
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={t('history.title')} />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
          <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">{t('history.loading')}</p>
        </div>
      </div>
    )
  }

  if (batches.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={t('history.title')} />
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            icon={Clock}
            title={t('history.noHistory')}
            description={t('history.noHistoryDesc')}
            action={
              <Button variant="outline" onClick={() => navigate('sort')}>
                {t('history.goToSort')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t('history.title')}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            {t('history.clearHistory')}
          </Button>
        }
      />

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        {/* Batch list */}
        <ResizablePanel defaultSize={35} minSize={25}>
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-0.5 p-2">
              {batches.map((batch) => {
                const isSelected = batch.batchId === selectedBatchId
                const mode = batch.operations[0]?.operationType ?? 'copy'

                return (
                  <button
                    key={batch.batchId}
                    onClick={() => selectBatch(batch.batchId)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                      isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      {mode === 'copy' ? (
                        <Copy className="size-3.5 text-foreground" />
                      ) : (
                        <Scissors className="size-3.5 text-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {batch.totalFiles}{' '}
                        {batch.totalFiles === 1 ? t('sort.file') : t('sort.files')}{' '}
                        {t('history.sorted')}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatTimestamp(batch.timestamp)}
                      </p>
                    </div>
                    {batch.undoneAt && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        <Undo2 className="size-3" />
                        {t('history.undone')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle />

        {/* Batch detail */}
        <ResizablePanel defaultSize={65}>
          {selected ? (
            <BatchDetail
              batch={selected}
              undoing={undoing === selected.batchId}
              onUndo={() => setConfirmingUndo(true)}
              onDelete={() => handleDeleteBatch(selected.batchId)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <EmptyState icon={Clock} title={t('history.selectBatch')} />
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Undo confirmation */}
      <Dialog open={confirmingUndo} onOpenChange={setConfirmingUndo}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-sm">{t('history.undoConfirmTitle')}</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              {t('history.undoConfirmDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button size="sm" variant="destructive" onClick={handleUndoConfirm}>
              <Undo2 className="mr-1 size-3.5" />
              {t('history.undo')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
