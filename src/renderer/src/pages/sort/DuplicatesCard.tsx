import { useState } from 'react'
import { AlertTriangle, Files, Trash2, X } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Card, CardContent } from '@shared/ui/card'
import { cn, formatBytes } from '@shared/lib/utils'
import { useLanguage } from '@app/providers/useLanguage'
import type { ClassifiedFile, DuplicateGroup } from '@shared/api/ipc'

interface DuplicatesCardProps {
  duplicates: DuplicateGroup[]
  classified: ClassifiedFile[]
  onRemoveDuplicates: (paths: string[]) => void
  onDismiss: () => void
  className?: string
}

export function DuplicatesCard({
  duplicates,
  classified,
  onRemoveDuplicates,
  onDismiss,
  className
}: DuplicatesCardProps): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const totalDuplicateFiles = duplicates.reduce((sum, g) => sum + g.paths.length - 1, 0)
  const totalWastedBytes = duplicates.reduce((sum, g) => sum + g.size * (g.paths.length - 1), 0)

  // Selected-for-removal paths — defaults to every copy except the first per
  // group. Reset during render when the groups change (no effect needed).
  function defaultSelection(groups: DuplicateGroup[]): Set<string> {
    const preselected = new Set<string>()
    for (const group of groups) {
      for (let i = 1; i < group.paths.length; i++) {
        preselected.add(group.paths[i])
      }
    }
    return preselected
  }
  const [selected, setSelected] = useState<Set<string>>(() => defaultSelection(duplicates))
  const [prevDuplicates, setPrevDuplicates] = useState(duplicates)
  if (duplicates !== prevDuplicates) {
    setPrevDuplicates(duplicates)
    setSelected(defaultSelection(duplicates))
  }

  function toggle(path: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  // Build a name lookup from classified files
  const nameByPath = new Map<string, string>()
  for (const f of classified) {
    nameByPath.set(f.path, f.name)
  }

  return (
    <Card className={cn('shadow-sm border-warning/30', className)}>
      <CardContent className="p-0">
        <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-warning-subtle rounded-t-xl">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <p className="text-sm font-medium text-foreground">
              {t('sort.duplicatesFound')}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {totalDuplicateFiles}{' '}
                {totalDuplicateFiles !== 1 ? t('sort.duplicateFiles') : t('sort.duplicateFile')}{' '}
                &middot; {formatBytes(totalWastedBytes)} {t('sort.wasted')}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemoveDuplicates(Array.from(selected))}
              disabled={selected.size === 0}
              className="text-xs h-7"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              {t('sort.removeDuplicates')} ({selected.size})
            </Button>
            <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[240px] overflow-auto divide-y divide-border/50">
          {duplicates.map((group) => (
            <div key={group.hash} className="px-6 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Files className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {group.paths.length} {t('sort.identicalFiles')} &middot; {formatBytes(group.size)}{' '}
                  {t('sort.each')}
                </span>
              </div>
              <div className="space-y-1 pl-5">
                {group.paths.map((path) => (
                  <div key={path} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selected.has(path)}
                      onChange={() => toggle(path)}
                      className="h-3.5 w-3.5 shrink-0 accent-[color:var(--destructive)] cursor-pointer"
                      aria-label={`Remove ${path}`}
                    />
                    {selected.has(path) ? (
                      <span className="shrink-0 rounded bg-destructive-subtle px-1 py-0.5 text-[10px] font-medium text-destructive">
                        {t('sort.remove')}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {t('sort.keep')}
                      </span>
                    )}
                    <span className="text-foreground truncate" title={path}>
                      {nameByPath.get(path) ?? path.split('/').pop()}
                    </span>
                    <span
                      className="text-muted-foreground truncate shrink-0 max-w-[200px]"
                      title={path}
                    >
                      {path}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
