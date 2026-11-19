import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import {
  dialogOpen,
  keyLabels,
  platformOf,
  SHORTCUTS,
  shortcutOf
} from '@features/shortcuts/shortcuts'
import { useWindowEvent } from '@shared/hooks/useSubscription'
import { IconButton } from '@shared/ui/IconButton'

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
  useWindowEvent('keydown', (event) => {
    if (open || shortcutOf(event, platform) !== 'searchChat' || dialogOpen()) return
    event.preventDefault()
    onOpen()
  })

  if (!slot) return null
  return createPortal(
    children || (
      <IconButton
        label={label}
        shortcut={KEY_LABEL}
        aria-keyshortcuts={KEY_ARIA}
        onClick={onOpen}
        className="size-10"
      >
        <Search />
      </IconButton>
    ),
    slot
  )
}
