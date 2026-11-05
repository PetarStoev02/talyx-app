import { useEffect, useRef } from 'react'

/**
 * Focuses `target` when `key` changes and focus fell to the page body, which is where it lands
 * when the focused control unmounts (an answered card, a closed panel). The first render is
 * skipped, so opening a view never moves focus.
 */
export function useRefocus(target: React.RefObject<HTMLElement | null>, key: unknown): void {
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!document.activeElement || document.activeElement === document.body) target.current?.focus()
  }, [target, key])
}
