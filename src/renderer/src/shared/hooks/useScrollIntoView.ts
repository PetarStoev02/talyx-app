import { useCallback, useEffect, useRef } from 'react'

/**
 * Scrolls `target` to the middle of its scroller each time `place` names a new place to be, so
 * content that only repaints (new text, the same match) does not scroll. The returned function
 * forgets the last place: the next render scrolls even when the place is the same.
 */
export function useScrollIntoView(target: Element | null, place: string): () => void {
  const scrolled = useRef('')
  useEffect(() => {
    if (!target || scrolled.current === place) return
    scrolled.current = place
    target.scrollIntoView({ block: 'center' })
  }, [target, place])
  return useCallback(() => {
    scrolled.current = ''
  }, [])
}
