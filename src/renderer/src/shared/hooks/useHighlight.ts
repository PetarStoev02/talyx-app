import { useEffect } from 'react'

/**
 * Paints `ranges` with the CSS custom highlight `name` (styled by `::highlight(name)`), and
 * removes it when there is nothing to paint and on unmount. The page's markup is never touched.
 */
export function useHighlight(name: string, ranges: readonly Range[]): void {
  useEffect(() => {
    if (ranges.length) CSS.highlights.set(name, new Highlight(...ranges))
    else CSS.highlights.delete(name)
  }, [name, ranges])
  useEffect(() => () => void CSS.highlights.delete(name), [name])
}
