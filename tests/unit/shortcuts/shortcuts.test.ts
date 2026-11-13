import { describe, expect, it } from 'vitest'
import {
  SHORTCUTS,
  keyLabels,
  platformOf,
  shortcutOf,
  type KeyPress
} from '../../../src/renderer/src/features/shortcuts/shortcuts'
import { t } from '../../../src/renderer/src/shared/lib/i18n'

const press = (key: string, held: Partial<Omit<KeyPress, 'key'>> = {}): KeyPress => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...held
})

describe('shortcuts', () => {
  describe('which shortcut a key press is', () => {
    it.each([
      ['mac', press('n', { metaKey: true }), 'newBot'],
      ['linux', press('n', { ctrlKey: true }), 'newBot'],
      ['mac', press('ArrowDown', { altKey: true }), 'nextChat'],
      ['linux', press('ArrowDown', { altKey: true }), 'nextChat'],
      ['mac', press('ArrowUp', { altKey: true }), 'previousChat'],
      ['linux', press('ArrowUp', { altKey: true }), 'previousChat'],
      ['mac', press('l', { metaKey: true }), 'focusComposer'],
      ['linux', press('l', { ctrlKey: true }), 'focusComposer'],
      ['mac', press('/', { metaKey: true }), 'cheatSheet'],
      ['linux', press('/', { ctrlKey: true }), 'cheatSheet'],
      ['mac', press(',', { metaKey: true }), 'settings'],
      ['linux', press(',', { ctrlKey: true }), 'settings'],
      // Caps Lock turns the key upper case without Shift.
      ['mac', press('N', { metaKey: true }), 'newBot']
    ] as const)('given %s and %o, should be %s', (platform, event, expected) => {
      expect(shortcutOf(event, platform)).toBe(expected)
    })

    it.each([
      ['the other platform’s modifier on macOS', 'mac', press('n', { ctrlKey: true })],
      ['the other platform’s modifier on Linux', 'linux', press('n', { metaKey: true })],
      [
        'an extra Shift (the license key’s ⌘⇧L)',
        'mac',
        press('L', { metaKey: true, shiftKey: true })
      ],
      ['both modifiers', 'mac', press('n', { metaKey: true, ctrlKey: true })],
      ['a plain letter', 'mac', press('n')],
      ['an arrow without Alt', 'linux', press('ArrowDown')]
    ] as const)('given %s, should be no shortcut', (_case, platform, event) => {
      expect(shortcutOf(event, platform)).toBeNull()
    })
  })

  describe('how a shortcut is written', () => {
    const keysOf = (id: string): (typeof SHORTCUTS)[number]['keys'] =>
      SHORTCUTS.find((shortcut) => shortcut.id === id)!.keys

    it.each([
      ['newBot', 'mac', ['⌘', 'N']],
      ['newBot', 'linux', ['Ctrl', 'N']],
      ['nextChat', 'mac', ['⌥', '↓']],
      ['nextChat', 'linux', ['Alt', '↓']],
      ['newLine', 'mac', ['⇧', 'Enter']],
      ['newLine', 'linux', ['Shift', 'Enter']],
      ['cheatSheet', 'mac', ['⌘', '/']],
      ['leave', 'linux', ['Esc']]
    ] as const)('given %s on %s, should read %o', (id, platform, expected) => {
      expect(keyLabels(keysOf(id), platform)).toEqual(expected)
    })
  })

  describe('the list the cheat sheet reads', () => {
    it.each(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]))(
      'given %s, should have a label to show',
      (_id, shortcut) => {
        expect(t(shortcut.label, 'en')).toBeTruthy()
      }
    )

    it('should give no two shortcuts the same keys', () => {
      const keys = SHORTCUTS.map((shortcut) => JSON.stringify(shortcut.keys))
      expect(new Set(keys).size).toBe(keys.length)
    })

    it('should give each shortcut its own id', () => {
      const ids = SHORTCUTS.map((shortcut) => shortcut.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  describe('the platform', () => {
    it.each([
      ['MacIntel', 'mac'],
      ['darwin', 'mac'],
      ['Linux x86_64', 'linux'],
      ['', 'linux']
    ] as const)('given %j, should be %s', (name, expected) => {
      expect(platformOf(name)).toBe(expected)
    })
  })
})
