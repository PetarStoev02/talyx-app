import { useEffect } from 'react'
import { useNavigation } from '@app/providers/useNavigation'
import { useRoster } from '@features/bots/store'
import { platformOf, shortcutOf, type ShortcutId } from '@features/shortcuts/shortcuts'
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
      const sheetOpen = useCheatSheet.getState().open
      const dialogOpen = !!document.querySelector('[role="dialog"], [role="alertdialog"]')
      if (dialogOpen && !(id === 'cheatSheet' && sheetOpen)) return
      event.preventDefault()
      void action()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

const ACTIONS: Partial<Record<ShortcutId, () => unknown>> = {
  newBot: async () => {
    if (!(await useNavigation.getState().navigate('agents'))) return
    useRoster.getState().clearError()
    useCreating.getState().setCreating('bot')
  },
  previousChat: () => switchChat(-1),
  nextChat: () => switchChat(1),
  focusComposer: async () => {
    if (await useNavigation.getState().navigate('agents')) focusComposer()
  },
  settings: () => useNavigation.getState().toggleSettings(),
  cheatSheet: () => {
    const { open, setOpen } = useCheatSheet.getState()
    setOpen(!open)
  }
}
