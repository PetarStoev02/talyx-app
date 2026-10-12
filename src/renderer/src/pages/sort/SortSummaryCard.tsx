import { ArrowDownUp, Check, FolderMinus, FolderTree, History, Pencil } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Card, CardContent } from '@shared/ui/card'
import { useLanguage } from '@app/providers/useLanguage'

export interface SortSummary {
  totalFiles: number
  categories: number
  renamed: number
  emptyFoldersCleaned: number
}

interface SortSummaryCardProps {
  fileCount: number
  summary: SortSummary | null
  onViewHistory: () => void
  onStartOver: () => void
}

/** The done state: what the sort did, and the two ways out of it. */
export function SortSummaryCard({
  fileCount,
  summary,
  onViewHistory,
  onStartOver
}: SortSummaryCardProps): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <Card className="shadow-sm">
      <CardContent className="p-0">
        <div className="px-6 py-4 flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
            <Check className="h-5 w-5 text-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{t('sort.done')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('sort.filesOrganized').replace('{count}', String(fileCount))}
            </p>

            {summary && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <FolderTree className="h-3 w-3" />
                  {t('sort.categoriesUsed').replace('{count}', String(summary.categories))}
                </span>
                {summary.renamed > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Pencil className="h-3 w-3" />
                    {t('sort.filesRenamed').replace('{count}', String(summary.renamed))}
                  </span>
                )}
                {summary.emptyFoldersCleaned > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <FolderMinus className="h-3 w-3" />
                    {t('sort.emptyFoldersCleaned').replace(
                      '{count}',
                      String(summary.emptyFoldersCleaned)
                    )}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onViewHistory}>
              <History className="h-3 w-3" />
              {t('sort.viewHistory')}
            </Button>
            <Button variant="outline" size="sm" onClick={onStartOver} className="gap-1.5 text-xs">
              <ArrowDownUp className="h-3 w-3" />
              {t('sort.startOver')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
