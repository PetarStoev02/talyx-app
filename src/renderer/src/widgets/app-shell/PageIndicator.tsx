import { useState } from 'react'
import { type AppView, useNavigation } from '@features/modules/store'
import { cn } from '@shared/lib/utils'

// The edge that leads the move goes first; the trailing edge follows this much later, so the disc
// stretches toward the new page and then gathers there, like a drop of liquid.
const TRAIL_MS = 90

/**
 * The disc under the open page, sliding between pages along `axis` (the dock's row, the rail's
 * column). `step` is one page's size plus the gap, `pad` the inset before the first page. Hidden
 * while a page outside these is open.
 */
export function PageIndicator({
  views,
  axis,
  step,
  pad,
  className
}: {
  views: AppView[]
  axis: 'x' | 'y'
  step: number
  pad: number
  className: string
}): React.JSX.Element {
  const index = useNavigation((s) => views.indexOf(s.currentView))
  // The last page here and the one before it. Leaving to Settings keeps both, and the disc fades
  // out where it was, so coming back slides it from there.
  const [move, setMove] = useState({ to: index, from: index })
  if (index >= 0 && index !== move.to) setMove({ to: index, from: move.to })
  const forward = move.to > move.from
  const back = move.to < move.from
  const at = index >= 0 ? index : Math.max(move.to, 0)
  const [lead, trail] = axis === 'x' ? ['left', 'right'] : ['top', 'bottom']
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-[opacity]',
        axis === 'x' ? 'transition-[left,right,opacity]' : 'transition-[top,bottom,opacity]',
        index < 0 ? 'opacity-0' : 'opacity-100',
        className
      )}
      style={{
        [lead]: pad + at * step,
        [trail]: pad + (views.length - 1 - at) * step,
        // Listed in the transition's order: the start edge, the end edge, opacity.
        transitionDelay: forward
          ? `${TRAIL_MS}ms, 0ms, 0ms`
          : back
            ? `0ms, ${TRAIL_MS}ms, 0ms`
            : '0ms'
      }}
    />
  )
}
