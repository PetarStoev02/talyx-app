import * as React from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="rounded-full bg-muted p-4">
        <Icon className="size-8 text-muted-foreground/50" />
      </div>
      <p className="mt-4 text-sm font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-xs text-muted-foreground/60">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
