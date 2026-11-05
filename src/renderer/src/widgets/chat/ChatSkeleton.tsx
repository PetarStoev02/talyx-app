import { Loading, Skeleton } from '@shared/ui/skeleton'

/** A conversation on its way: a few bubbles, theirs on the left, yours on the right. */
export function ChatSkeleton({ label }: { label: string }): React.JSX.Element {
  return (
    <Loading label={label} className="min-h-0 flex-1">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6">
        <Skeleton className="h-10 w-2/5 self-end rounded-3xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-3/5 rounded-3xl" />
        </div>
        <Skeleton className="h-10 w-1/3 self-end rounded-3xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-14 w-1/2 rounded-3xl" />
        </div>
      </div>
    </Loading>
  )
}
