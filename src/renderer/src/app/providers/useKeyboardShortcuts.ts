import { useEffect } from 'react'
import { useNavigation } from '@app/providers/useNavigation'
import { useRoster } from '@features/bots/store'
import { dialogOpen, platformOf, shortcutOf, type ShortcutId } from '@features/shortcuts/shortcuts'
import { focusComposer } from '@widgets/chat'
import { switchChat, useCreating } from '@widgets/roster'
import { useCheatSheet } from '@widgets/shortcuts'

const platform = platformOf(navigator.platform)

/**
 * Binds the app-wide shortcuts of `SHORTCUT_GROUPS`; the rest are bound where they apply. While a
 * dialog is open only ⌘/ works, and only to close the cheat sheet.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.repeat) return
      const id = shortcutOf(event, platform)
      const action = id && ACTIONS[id]
      if (!action) return
      if (dialogOpen() && !(id === 'cheatSheet' && useCheatSheet.getState().open)) return
      if (CARET_KEYS.has(id) && keepsCaret(event.target)) return
      event.preventDefault()
      void action()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

// ⌥↑ and ⌥↓ move the caret by paragraph in a text field (macOS).
const CARET_KEYS = new Set<ShortcutId>(['previousChat', 'nextChat'])

/**
 * Whether a key press in `target` belongs to the text field it is in. An empty message box has no
 * caret to move or draft to lose, so from there ⌥↑ and ⌥↓ still switch chats (after ⌘L). Any other
 * field keeps them: a bot's unsaved details would go with a switch.
 */
function keepsCaret(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const field = target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')
  if (!field) return false
  return !(
    field instanceof HTMLTextAreaElement &&
    field.dataset.composer !== undefined &&
    !field.value
  )
}

async function toChat(step: 1 | -1): Promise<void> {
  // As a click on a row does, from Settings or a module page too.
  if (await useNavigation.getState().navigate('agents')) switchChat(step)
}

const ACTIONS: Partial<Record<ShortcutId, () => unknown>> = {
  newBot: async () => {
    if (!(await useNavigation.getState().navigate('agents'))) return
    useRoster.getState().clearError()
    useCreating.getState().setCreating('bot')
  },
  previousChat: () => toChat(-1),
  nextChat: () => toChat(1),
  focusComposer: async () => {
    if (await useNavigation.getState().navigate('agents')) focusComposer()
  },
  settings: () => useNavigation.getState().toggleSettings(),
  cheatSheet: () => {
    const { open, setOpen } = useCheatSheet.getState()
    setOpen(!open)
  }
}
