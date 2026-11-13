import type { TranslationKey } from '@shared/lib/i18n'

export type Platform = 'mac' | 'linux'

/** The keys of a shortcut. `mod` is ⌘ on macOS and Ctrl on Linux. */
export interface Keys {
  mod?: true
  alt?: true
  shift?: true
  // A `KeyboardEvent.key`, or a word for what is not a key press (`Click`, `1-9`).
  key: string
}

export type ShortcutId =
  | 'newBot'
  | 'previousChat'
  | 'nextChat'
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
 * `useKeyboardShortcuts`; the composer, the roster, the dock and Settings bind the rest where they
 * apply. The menu's own (copy, paste, zoom, quit) are the system's and not listed.
 */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: 'shortcuts.chats',
    shortcuts: [
      { id: 'newBot', label: 'shortcuts.newBot', keys: { mod: true, key: 'n' } },
      { id: 'previousChat', label: 'shortcuts.previousChat', keys: { alt: true, key: 'ArrowUp' } },
      { id: 'nextChat', label: 'shortcuts.nextChat', keys: { alt: true, key: 'ArrowDown' } },
      { id: 'pickRow', label: 'shortcuts.pickRow', keys: { mod: true, key: 'Click' } },
      { id: 'pickRange', label: 'shortcuts.pickRange', keys: { shift: true, key: 'Click' } }
    ]
  },
  {
    label: 'shortcuts.composer',
    shortcuts: [
      { id: 'focusComposer', label: 'shortcuts.focusComposer', keys: { mod: true, key: 'l' } },
      { id: 'send', label: 'shortcuts.send', keys: { key: 'Enter' } },
      { id: 'newLine', label: 'shortcuts.newLine', keys: { shift: true, key: 'Enter' } }
    ]
  },
  {
    label: 'shortcuts.app',
    shortcuts: [
      { id: 'dockPage', label: 'shortcuts.dockPage', keys: { mod: true, key: '1-9' } },
      { id: 'settings', label: 'shortcuts.settings', keys: { mod: true, key: ',' } },
      { id: 'leave', label: 'shortcuts.leave', keys: { key: 'Escape' } },
      { id: 'cheatSheet', label: 'shortcuts.cheatSheet', keys: { mod: true, key: '/' } }
    ]
  }
]

export const SHORTCUTS: Shortcut[] = SHORTCUT_GROUPS.flatMap((group) => group.shortcuts)

export type KeyPress = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>

/** The shortcut a key press is, with exactly its modifiers held; null for none. */
export function shortcutOf(event: KeyPress, platform: Platform): ShortcutId | null {
  const mod = platform === 'mac' ? event.metaKey : event.ctrlKey
  const other = platform === 'mac' ? event.ctrlKey : event.metaKey
  if (other) return null
  const match = SHORTCUTS.find(
    ({ keys }) =>
      !!keys.mod === mod &&
      !!keys.alt === event.altKey &&
      !!keys.shift === event.shiftKey &&
      keys.key.toLowerCase() === event.key.toLowerCase()
  )
  return match?.id ?? null
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

/** macOS or Linux, from `navigator.platform` or Node's `process.platform`. */
export function platformOf(name: string): Platform {
  return /mac|darwin/i.test(name) ? 'mac' : 'linux'
}
