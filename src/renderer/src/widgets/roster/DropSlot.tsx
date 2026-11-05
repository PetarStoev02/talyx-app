import { useState } from 'react'
import { cn } from '@shared/lib/utils'
import { draggedItem, endRosterDrag } from './drag'
import type { RosterDragItem } from './drag'

export type DropEdge = 'before' | 'after' | 'inside'

// On a folder header the top part puts a folder in front of it; the rest drops into it.
const BEFORE_SHARE = 0.3

/**
 * A row that takes roster drags: `edges` says where the dragged item may land (null: nowhere), and
 * a line, or a tint for `inside`, shows where it will.
 */
export function DropSlot({
  edges,
  onDrop,
  children
}: {
  edges: (item: RosterDragItem) => DropEdge[] | null
  onDrop: (item: RosterDragItem, edge: DropEdge) => void
  children: React.ReactNode
}): React.JSX.Element {
  const [edge, setEdge] = useState<DropEdge | null>(null)

  function edgeAt(event: React.DragEvent, allowed: DropEdge[]): DropEdge {
    const box = event.currentTarget.getBoundingClientRect()
    const share = (event.clientY - box.top) / box.height
    if (allowed.length === 1) return allowed[0]
    if (allowed.includes('inside')) return share < BEFORE_SHARE ? 'before' : 'inside'
    return share < 0.5 ? 'before' : 'after'
  }

  return (
    <div
      className={cn('relative rounded-xl', edge === 'inside' && 'bg-foreground/10')}
      onDragOver={(event) => {
        const item = draggedItem()
        const allowed = item && edges(item)
        if (!allowed?.length) return
        event.preventDefault()
        event.stopPropagation()
        setEdge(edgeAt(event, allowed))
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setEdge(null)
      }}
      onDrop={(event) => {
        const item = draggedItem()
        const at = edge
        setEdge(null)
        if (!item || !at) return
        event.preventDefault()
        event.stopPropagation()
        endRosterDrag()
        onDrop(item, at)
      }}
    >
      {edge === 'before' && <DropLine className="-top-0.5" />}
      {children}
      {edge === 'after' && <DropLine className="-bottom-0.5" />}
    </div>
  )
}

function DropLine({ className }: { className: string }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-2 z-10 h-0.5 rounded-full bg-brand',
        className
      )}
    />
  )
}
