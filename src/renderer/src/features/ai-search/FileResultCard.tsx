import {
  FileText,
  Music,
  Video,
  Image,
  Package,
  Code,
  Archive,
  HelpCircle,
  FolderOpen
} from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { folderApi, type SearchResult } from '@shared/api/ipc'

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Documents: FileText,
  Audio: Music,
  Videos: Video,
  Images: Image,
  Software: Package,
  Code: Code,
  Archives: Archive
}

interface FileResultCardProps {
  result: SearchResult
  selected?: boolean
  onSelect?: (result: SearchResult) => void
}

export function FileResultCard({
  result,
  selected = false,
  onSelect
}: FileResultCardProps): React.JSX.Element {
  const Icon = categoryIcons[result.category] ?? HelpCircle

  function handleClick(): void {
    if (onSelect) {
      onSelect(result)
    } else {
      folderApi.showInExplorer(result.filePath)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 text-left transition-colors',
        selected ? 'bg-accent' : 'bg-card hover:bg-accent/50'
      )}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{result.fileName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {result.category}
          {result.subcategory ? ` > ${result.subcategory}` : ''}
          {result.snippet ? ` — ${result.snippet.replace(/<[^>]*>/g, '')}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[9px] font-medium',
            result.source === 'both' && 'bg-success-subtle text-success',
            result.source === 'keyword' && 'bg-info-subtle text-info',
            result.source === 'semantic' && 'bg-info-subtle text-info'
          )}
        >
          {result.source === 'both'
            ? 'Best'
            : result.source === 'semantic'
              ? 'Semantic'
              : 'Keyword'}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            folderApi.showInExplorer(result.filePath)
          }}
          aria-label="Show in file explorer"
          className="flex size-6 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:text-foreground"
        >
          <FolderOpen className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
