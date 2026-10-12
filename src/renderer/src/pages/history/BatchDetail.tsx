import { Undo2, Trash2, Copy, Scissors, ArrowRight } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { ScrollArea } from '@shared/ui/scroll-area'
import { cn } from '@shared/lib/utils'
import { getCategoryChartBg } from '@shared/lib/categoryChart'
import { useLanguage } from '@app/providers/useLanguage'
import { deriveBatchLabel } from '@widgets/app-shell/deriveRecentSorts'
import type { SortBatch } from '@shared/api/ipc'
import { formatTimestamp, formatFileSize, shortenPath } from './format'

interface BatchDetailProps {
  batch: SortBatch
  undoing: boolean
  onUndo: () => void
  onDelete: () => void
}

export function BatchDetail({
  batch,
  undoing,
  onUndo,
  onDelete
}: BatchDetailProps): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const mode = batch.operations[0]?.operationType ?? 'copy'

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {deriveBatchLabel(batch)}
          </h2>
          {batch.undoneAt && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <Undo2 className="size-3" />
              {t('history.undone')}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatTimestamp(batch.timestamp)}</p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 px-6 py-4">
          {/* Properties */}
          <section>
            <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {t('history.properties')}
            </h3>
            <div className="space-y-1.5">
              <PropertyRow
                label={t('history.mode')}
                value={
                  <span className="inline-flex items-center gap-1.5">
                    {mode === 'copy' ? (
                      <Copy className="size-3 text-muted-foreground" />
                    ) : (
                      <Scissors className="size-3 text-muted-foreground" />
                    )}
                    {mode === 'copy' ? t('sort.copy') : t('sort.move')}
                  </span>
                }
              />
              <PropertyRow
                label={t('history.time')}
                value={new Date(batch.timestamp).toLocaleString()}
              />
              <PropertyRow label={t('history.fileCount')} value={String(batch.totalFiles)} />
              {batch.undoneAt && (
                <PropertyRow
                  label={t('history.undoneAt')}
                  value={new Date(batch.undoneAt).toLocaleString()}
                />
              )}
            </div>
          </section>

          {/* Operations */}
          <section>
            <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {t('sort.files')}
            </h3>
            <div className="space-y-1.5">
              {batch.operations.map((op, idx) => (
                <div
                  key={op.id ?? idx}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{op.fileName}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                      <span className="truncate">{shortenPath(op.sourcePath)}</span>
                      <ArrowRight className="size-3 shrink-0 text-muted-foreground/60" />
                      <span className="truncate">{shortenPath(op.destPath)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {op.category && (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <span
                          className={cn('size-1.5 rounded-full', getCategoryChartBg(op.category))}
                        />
                        {op.category}
                        {op.subcategory ? ` / ${op.subcategory}` : ''}
                      </span>
                    )}
                    {op.fileSize !== null && op.fileSize > 0 && (
                      <span className="text-muted-foreground/60">
                        {formatFileSize(op.fileSize)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
        {!batch.undoneAt && (
          <Button
            variant="outline"
            size="sm"
            disabled={undoing}
            onClick={onUndo}
            className="gap-1.5 text-xs"
          >
            {undoing ? (
              <div className="size-3.5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
            ) : (
              <Undo2 className="size-3.5" />
            )}
            {undoing ? t('history.undoing') : t('history.undo')}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
          {t('common.delete')}
        </Button>
      </div>
    </div>
  )
}

function PropertyRow({
  label,
  value
}: {
  label: string
  value: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="truncate text-right text-[11px] text-foreground">{value}</span>
    </div>
  )
}
