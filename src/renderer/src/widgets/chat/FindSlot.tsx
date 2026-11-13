import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import {
  dialogOpen,
  keyLabels,
  platformOf,
  SHORTCUTS,
  shortcutOf
} from '@features/shortcuts/shortcuts'

const platform = platformOf(navigator.platform)
// The search's shortcut, read from the shortcut list, as the button's tooltip shows it and as
// aria-keyshortcuts names it.
const KEYS = SHORTCUTS.find((shortcut) => shortcut.id === 'searchChat')!.keys
const KEY_LABEL = keyLabels(KEYS, platform).join(platform === 'mac' ? '' : '+')
const KEY_ARIA = [
  KEYS.mod && (platform === 'mac' ? 'Meta' : 'Control'),
  KEYS.alt && 'Alt',
  KEYS.shift && 'Shift',
  KEYS.key.toUpperCase()
]
  .filter(Boolean)
  .join('+')

/**
 * The search in the page header, on the line with the name pill: the open find (`children`), or a
 * button that opens one. ⌘F (Ctrl+F) presses the button; a dialog over the chat keeps the key.
 */
export function FindSlot({
  slot,
  label,
  onOpen,
  children
}: {
  slot: HTMLElement | null
  label: string
  onOpen: () => void
  // The open find, or nothing while it is closed.
  children: React.ReactNode
}): React.JSX.Element | null {
  const open = !!children
  useEffect(() => {
    if (open) return
    function onKey(event: KeyboardEvent): void {
      if (shortcutOf(event, platform) !== 'searchChat' || dialogOpen()) return
      event.preventDefault()
      onOpen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpen])

  if (!slot) return null
  return createPortal(
    children || (
      <button
        type="button"
        aria-label={label}
        aria-keyshortcuts={KEY_ARIA}
        title={`${label} (${KEY_LABEL})`}
        onClick={onOpen}
        className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
      >
        <Search size={18} />
      </button>
    ),
    slot
  )
}
