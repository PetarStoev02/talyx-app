import { useEffect } from 'react'

/**
 * Paints `ranges` with the CSS custom highlight `name` (styled by `::highlight(name)`), and
 * removes it on unmount. The page's markup is never touched.
 */
export function useHighlight(name: string, ranges: readonly Range[]): void {
  useEffect(() => {
    CSS.highlights.set(name, new Highlight(...ranges))
  }, [name, ranges])
  useEffect(() => () => void CSS.highlights.delete(name), [name])
}
