import { Trash2, Copy, Scissors, Activity, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { ScrollArea } from '@shared/ui/scroll-area'
import { cn } from '@shared/lib/utils'
import { useLanguage } from '@app/providers/useLanguage'
import type { WatchEvent, WatchFolder } from '@shared/api/ipc'

export interface TimestampedEvent extends WatchEvent {
  timestamp: number
}

function basename(p: string): string {
  return p.split('/').pop() || p
}

interface FolderDetailProps {
  folder: WatchFolder
  events: TimestampedEvent[]
  removing: boolean
  onToggle: () => void
  onToggleSortMode: () => void
  onRemove: () => void
}

export function WatchFolderDetail({
  folder,
  events,
  removing,
  onToggle,
  onToggleSortMode,
  onRemove
}: FolderDetailProps): React.JSX.Element {
  const t = useLanguage((s) => s.t)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {basename(folder.path)}
          </h2>
          <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {folder.enabled ? t('watch.enabled') : t('watch.paused')}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{folder.path}</p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 px-6 py-4">
          <section>
            <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {t('watch.properties')}
            </h3>
            <div className="space-y-1.5">
              <PropertyRow label={t('watch.path')} value={folder.path} />
              <PropertyRow
                label={t('watch.output')}
                value={folder.outputPath ?? t('watch.notSet')}
              />
              <PropertyRow
                label={t('watch.mode')}
                value={
                  <button
                    type="button"
                    onClick={onToggleSortMode}
                    className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                  >
                    {folder.sortMode === 'copy' ? (
                      <Copy className="size-3" />
                    ) : (
                      <Scissors className="size-3" />
                    )}
                    {folder.sortMode === 'copy' ? t('sort.copy') : t('sort.move')}
                  </button>
                }
              />
              <PropertyRow
                label={t('watch.status')}
                value={
                  <button
                    type="button"
                    onClick={onToggle}
                    aria-pressed={folder.enabled}
                    className={cn(
                      'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                      folder.enabled ? 'bg-foreground' : 'bg-muted-foreground/30'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 size-4 rounded-full bg-background shadow transition-transform',
                        folder.enabled ? 'left-[18px]' : 'left-0.5'
                      )}
                    />
                  </button>
                }
              />
            </div>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <Activity className="size-3" />
              {t('watch.activity')}
              {events.length > 0 && (
                <span className="font-normal normal-case tracking-normal text-muted-foreground/70">
                  {events.length} {events.length !== 1 ? t('watch.events') : t('watch.event')}
                </span>
              )}
            </h3>
            {events.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {t('watch.noActivity')}
              </p>
            ) : (
              <div className="space-y-1">
                {events.map((evt, i) => (
                  <div
                    key={`${evt.timestamp}-${i}`}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2"
                  >
                    {evt.type === 'file-sorted' ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-foreground" />
                    ) : (
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {evt.type === 'file-sorted'
                          ? `${evt.filePath.split('/').pop()} → ${evt.category}`
                          : (evt.error ?? t('watch.error'))}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {new Date(evt.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </ScrollArea>

      <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className={cn(
            'gap-1.5 text-xs',
            removing
              ? 'text-destructive hover:text-destructive'
              : 'text-muted-foreground hover:text-destructive'
          )}
        >
          <Trash2 className="size-3.5" />
          {removing ? t('watch.confirmRemove') : t('common.delete')}
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
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-[11px] text-foreground">{value}</span>
    </div>
  )
}
