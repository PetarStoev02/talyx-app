import { useLastValue, useStayMounted } from '@shared/hooks/useStayMounted'
import { cn } from '@shared/lib/utils'

/**
 * Opens and closes by height (theme.css `.reveal`): shown while `value` is set, with `children`
 * given the value; while closing it keeps the last one. Closed, it is gone from the page.
 */
export function Reveal<T>({
  value,
  className,
  children
}: {
  value: T | null | undefined | false
  className?: string
  children: (value: T) => React.ReactNode
}): React.JSX.Element | null {
  const open = !!value
  const mounted = useStayMounted(open)
  const shown = useLastValue(value)
  if (!mounted || shown === null) return null
  return (
    <div data-open={open} inert={!open} className={cn('reveal', className)}>
      {children(shown)}
    </div>
  )
}

/**
 * The third column: slides in from the right edge (theme.css `.slide-panel`) while `value` is
 * set, and out again, keeping the last value while it goes. `className` places it.
 */
export function SlidePanel<T>({
  value,
  className,
  children
}: {
  value: T | null | undefined | false
  className?: string
  children: (value: T) => React.ReactNode
}): React.JSX.Element | null {
  const open = !!value
  const mounted = useStayMounted(open)
  const shown = useLastValue(value)
  if (!mounted || shown === null) return null
  return (
    <div
      data-open={open}
      inert={!open}
      className={cn('slide-panel flex shrink-0 justify-end overflow-hidden', className)}
    >
      {children(shown)}
    </div>
  )
}
