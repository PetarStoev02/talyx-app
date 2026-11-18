import { useWindowEvent } from './useSubscription'

/** Calls `onEscape` on Escape, unless a dialog or menu already took the key (they mark it handled). */
export function useEscape(onEscape: () => void): void {
  useWindowEvent('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    event.preventDefault()
    onEscape()
  })
}
