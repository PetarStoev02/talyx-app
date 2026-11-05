import { useState } from 'react'
import { useElapsed } from '@shared/hooks/useElapsed'
import { cn } from '@shared/lib/utils'

// A load quicker than this shows nothing at all, so a fast screen never flashes placeholders.
const SKELETON_DELAY_MS = 300

/** One gray placeholder shape; size and shape come from `className`. */
export function Skeleton({ className }: { className?: string }): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-lg bg-foreground/[0.07] motion-reduce:animate-none',
        className
      )}
    />
  )
}

/**
 * Something on its way: screen readers hear `label` at once; the placeholder shapes in
 * `children` show only once the wait is long enough to notice.
 */
export function Loading({
  label,
  className,
  children
}: {
  label: string
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  const [start] = useState(() => Date.now())
  const shown = useElapsed(start, SKELETON_DELAY_MS)
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      {shown && children}
    </div>
  )
}

/** Rows like a list's: an avatar or icon, a title line and a shorter line under it. */
export function SkeletonRows({
  count,
  avatar = true
}: {
  count: number
  avatar?: boolean
}): React.JSX.Element {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-3 p-2">
          {avatar && <Skeleton className="size-7 shrink-0" />}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
