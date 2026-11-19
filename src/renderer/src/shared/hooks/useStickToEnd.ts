import { useLayoutEffect, useRef, useState } from 'react'

// How close to the end still counts as reading the newest part.
const STICK_DISTANCE_PX = 48

/**
 * Keeps the `scroller` it returns at its end while the reader is there: after each render that
 * changed `content` (a stable value, such as a memo of what the scroller shows), and when `toEnd`
 * brings them back. Scrolling away lets go; `onScroll` goes on the scroller.
 */
export function useStickToEnd<T extends HTMLElement>(
  content: unknown
): {
  scroller: React.RefObject<T | null>
  atEnd: boolean
  onScroll: () => void
  toEnd: () => void
} {
  const scroller = useRef<T>(null)
  const [atEnd, setAtEnd] = useState(true)

  useLayoutEffect(() => {
    const element = scroller.current
    if (element && atEnd) element.scrollTop = element.scrollHeight
  }, [content, atEnd])

  function onScroll(): void {
    const element = scroller.current
    if (!element) return
    setAtEnd(element.scrollHeight - element.scrollTop - element.clientHeight < STICK_DISTANCE_PX)
  }

  return { scroller, atEnd, onScroll, toEnd: () => setAtEnd(true) }
}
