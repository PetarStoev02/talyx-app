import { useEffect } from 'react'

/** Calls `onEscape` on Escape, unless a dialog or menu already took the key (they mark it handled). */
export function useEscape(onEscape: () => void): void {
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      onEscape()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onEscape])
}
