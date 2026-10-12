import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Card, CardContent } from '@shared/ui/card'
import { cn } from '@shared/lib/utils'
import { useLanguage } from '@app/providers/useLanguage'
import type { ClassifiedFile } from '@shared/api/ipc'

interface RenamePanelProps {
  classified: ClassifiedFile[]
  approvedRenames: Record<string, string>
  rejectedRenames: Set<string>
  onApprove: (path: string, name: string) => void
  onReject: (path: string) => void
  onApproveAll: () => void
  onRejectAll: () => void
  onClose: () => void
  className?: string
}

export function RenamePanel({
  classified,
  approvedRenames,
  rejectedRenames,
  onApprove,
  onReject,
  onApproveAll,
  onRejectAll,
  onClose,
  className
}: RenamePanelProps): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const allRejected = rejectedRenames.has('__ALL_REJECTED__')
  // A suggestion that matches the current name is not a rename to review.
  const renameFiles = classified.filter(
    (f) =>
      f.classification.suggestedName &&
      f.classification.suggestedName !== f.name &&
      !allRejected &&
      !rejectedRenames.has(f.path)
  )

  return (
    <Card className={cn('shadow-sm', className)}>
      <CardContent className="p-0">
        <div className="px-6 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">
            {t('sort.renameSuggestions')}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {renameFiles.length} {t('sort.files')}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onApproveAll} className="text-xs h-7">
              <Check className="h-3 w-3 mr-1" />
              {t('sort.acceptAll')}
            </Button>
            <Button variant="outline" size="sm" onClick={onRejectAll} className="text-xs h-7">
              <X className="h-3 w-3 mr-1" />
              {t('sort.rejectAll')}
            </Button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[280px] overflow-auto divide-y divide-border/50">
          {renameFiles.map((file) => {
            const suggested = file.classification.suggestedName!
            const isApproved = file.path in approvedRenames

            return (
              <RenameRow
                key={file.path}
                originalName={file.name}
                suggestedName={suggested}
                isApproved={isApproved}
                onApprove={(name) => onApprove(file.path, name)}
                onReject={() => onReject(file.path)}
              />
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function RenameRow({
  originalName,
  suggestedName,
  isApproved,
  onApprove,
  onReject
}: {
  originalName: string
  suggestedName: string
  isApproved: boolean
  onApprove: (name: string) => void
  onReject: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(suggestedName)

  return (
    <div className="px-6 py-2 flex items-center gap-3 text-sm">
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-muted-foreground truncate text-xs" title={originalName}>
          {originalName}
        </span>
        <span className="text-muted-foreground/50 shrink-0">&rarr;</span>
        {editing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onApprove(editValue)
                setEditing(false)
              }
              if (e.key === 'Escape') setEditing(false)
            }}
            className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
            autoFocus
          />
        ) : (
          <span
            className={cn(
              'truncate text-xs font-medium cursor-pointer hover:underline',
              isApproved ? 'text-foreground' : 'text-muted-foreground'
            )}
            onClick={() => setEditing(true)}
            title={t('sort.clickToEdit')}
          >
            {suggestedName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              onApprove(editValue)
              setEditing(false)
            }}
          >
            <Check className="h-3 w-3 text-foreground" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onApprove(suggestedName)}
            title={t('sort.accept')}
          >
            <Check
              className={cn('h-3 w-3', isApproved ? 'text-foreground' : 'text-muted-foreground')}
            />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onReject}
          title={t('sort.reject')}
        >
          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </div>
  )
}
