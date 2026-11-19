import type { TranslationKey } from '@shared/lib/i18n'

export type Platform = 'mac' | 'linux'

/** The keys of a shortcut. `mod` is ⌘ on macOS and Ctrl on Linux. */
export interface Keys {
  mod: boolean
  alt: boolean
  shift: boolean
  // A `KeyboardEvent.key`, or a word for what is not a key press (`Click`, `1-9`).
  key: string
}

type Modifier = 'mod' | 'alt' | 'shift'

/** `key` with exactly the `held` modifiers. */
function chord(key: string, ...held: Modifier[]): Keys {
  return {
    mod: held.includes('mod'),
    alt: held.includes('alt'),
    shift: held.includes('shift'),
    key
  }
}

export type ShortcutId =
  | 'newBot'
  | 'previousChat'
  | 'nextChat'
  | 'searchChat'
  | 'focusComposer'
  | 'send'
  | 'newLine'
  | 'pickRow'
  | 'pickRange'
  | 'dockPage'
  | 'settings'
  | 'leave'
  | 'cheatSheet'

export interface Shortcut {
  id: ShortcutId
  label: TranslationKey
  keys: Keys
}

export interface ShortcutGroup {
  label: TranslationKey
  shortcuts: Shortcut[]
}

/**
 * Every shortcut Talyx has, as the cheat sheet lists them. Most are bound by
 * `useKeyboardShortcuts`; the chat's search, the composer, the roster, the dock and Settings bind
 * the rest where they apply. The menu's own (copy, paste, zoom, quit) are the system's and not
 * listed.
 */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: 'shortcuts.chats',
    shortcuts: [
      { id: 'newBot', label: 'shortcuts.newBot', keys: chord('n', 'mod') },
      { id: 'previousChat', label: 'shortcuts.previousChat', keys: chord('ArrowUp', 'alt') },
      { id: 'nextChat', label: 'shortcuts.nextChat', keys: chord('ArrowDown', 'alt') },
      { id: 'searchChat', label: 'shortcuts.searchChat', keys: chord('f', 'mod') },
      { id: 'pickRow', label: 'shortcuts.pickRow', keys: chord('Click', 'mod') },
      { id: 'pickRange', label: 'shortcuts.pickRange', keys: chord('Click', 'shift') }
    ]
  },
  {
    label: 'shortcuts.composer',
    shortcuts: [
      { id: 'focusComposer', label: 'shortcuts.focusComposer', keys: chord('l', 'mod') },
      { id: 'send', label: 'shortcuts.send', keys: chord('Enter') },
      { id: 'newLine', label: 'shortcuts.newLine', keys: chord('Enter', 'shift') }
    ]
  },
  {
    label: 'shortcuts.app',
    shortcuts: [
      { id: 'dockPage', label: 'shortcuts.dockPage', keys: chord('1-9', 'mod') },
      { id: 'settings', label: 'shortcuts.settings', keys: chord(',', 'mod') },
      { id: 'leave', label: 'shortcuts.leave', keys: chord('Escape') },
      { id: 'cheatSheet', label: 'shortcuts.cheatSheet', keys: chord('/', 'mod') }
    ]
  }
]

export const SHORTCUTS: Shortcut[] = SHORTCUT_GROUPS.flatMap((group) => group.shortcuts)

export type KeyPress = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'isComposing'
>

/**
 * The shortcut a key press is, with exactly its modifiers held; null for none, and for a key an
 * input method is still composing.
 */
export function shortcutOf(event: KeyPress, platform: Platform): ShortcutId | null {
  const mod = platform === 'mac' ? event.metaKey : event.ctrlKey
  const other = platform === 'mac' ? event.ctrlKey : event.metaKey
  if (other || event.isComposing) return null
  const match = SHORTCUTS.find(
    ({ keys }) =>
      keys.mod === mod &&
      keys.alt === event.altKey &&
      (keys.shift === event.shiftKey || shiftTyped(keys.key)) &&
      keys.key.toLowerCase() === event.key.toLowerCase()
  )
  return match?.id ?? null
}

// A punctuation key (/ or ,) needs Shift on some layouts (German: Shift+7 is /), so Shift there
// is part of typing the key, not a modifier of the shortcut.
function shiftTyped(key: string): boolean {
  return key.length === 1 && !/[a-z0-9]/i.test(key)
}

const KEY_NAMES: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc' }

/** The keys to press, one label each, in the platform's order and with its names. */
export function keyLabels(keys: Keys, platform: Platform): string[] {
  const key = KEY_NAMES[keys.key] ?? (keys.key.length === 1 ? keys.key.toUpperCase() : keys.key)
  // macOS writes ⌥⇧⌘, Linux Ctrl+Alt+Shift.
  const held =
    platform === 'mac'
      ? [keys.alt && '⌥', keys.shift && '⇧', keys.mod && '⌘']
      : [keys.mod && 'Ctrl', keys.alt && 'Alt', keys.shift && 'Shift']
  return [...held.filter((label): label is string => !!label), key]
}

/** macOS or Linux, from `navigator.platform`. */
export function platformOf(name: string): Platform {
  return /mac/i.test(name) ? 'mac' : 'linux'
}

/** Whether a dialog is open: the shortcuts behind it wait (only ⌘/ closes the cheat sheet). */
export function dialogOpen(): boolean {
  return !!document.querySelector('[role="dialog"], [role="alertdialog"]')
}
