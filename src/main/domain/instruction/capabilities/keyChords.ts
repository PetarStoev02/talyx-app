import { UnknownKeyError } from '../model/errors'

export type Modifier = 'cmd' | 'ctrl' | 'alt' | 'shift'

/** A key combination, already resolved to the macOS virtual key code to press. */
export interface KeyChord {
  /** Always in MODIFIER_ORDER, however the model typed them. */
  modifiers: Modifier[]
  key: string
  keyCode: number
}

/** The order macOS menus print modifiers in, so the card reads like a menu shortcut. */
const MODIFIER_ORDER: Modifier[] = ['ctrl', 'alt', 'shift', 'cmd']

/** Maps, not objects: the model's text is the key, and "constructor" must not resolve. */
const MODIFIER_ALIASES = new Map<string, Modifier>([
  ['cmd', 'cmd'],
  ['command', 'cmd'],
  ['ctrl', 'ctrl'],
  ['control', 'ctrl'],
  ['alt', 'alt'],
  ['option', 'alt'],
  ['opt', 'alt'],
  ['shift', 'shift']
])

const MODIFIER_SYMBOLS: Record<Modifier, string> = { ctrl: '⌃', alt: '⌥', shift: '⇧', cmd: '⌘' }

/** macOS virtual key codes (ANSI layout); the shape of the key, not the character it types. */
// prettier-ignore
const KEY_CODES = new Map(Object.entries({
  a: 0, s: 1, d: 2, f: 3, h: 4, g: 5, z: 6, x: 7, c: 8, v: 9, b: 11, q: 12, w: 13, e: 14,
  r: 15, y: 16, t: 17, '1': 18, '2': 19, '3': 20, '4': 21, '6': 22, '5': 23, '=': 24, '9': 25,
  '7': 26, '-': 27, '8': 28, '0': 29, ']': 30, o: 31, u: 32, '[': 33, i: 34, p: 35, return: 36,
  l: 37, j: 38, "'": 39, k: 40, ';': 41, '\\': 42, ',': 43, '/': 44, n: 45, m: 46, '.': 47,
  tab: 48, space: 49, '`': 50, delete: 51, escape: 53, f1: 122, f2: 120, f3: 99, f4: 118,
  f5: 96, f6: 97, f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111, home: 115,
  pageup: 116, forwarddelete: 117, end: 119, pagedown: 121, left: 123, right: 124, down: 125,
  up: 126
}))

const KEY_ALIASES = new Map([
  ['enter', 'return'],
  ['esc', 'escape'],
  ['backspace', 'delete'],
  ['arrowleft', 'left'],
  ['arrowright', 'right'],
  ['arrowup', 'up'],
  ['arrowdown', 'down']
])

const KEY_SYMBOLS: Record<string, string> = {
  return: '↩',
  tab: '⇥',
  space: 'Space',
  delete: '⌫',
  forwarddelete: '⌦',
  escape: '⎋',
  left: '←',
  right: '→',
  up: '↑',
  down: '↓',
  pageup: 'Page Up',
  pagedown: 'Page Down',
  home: 'Home',
  end: 'End'
}

/** "cmd+shift+p" → ⇧⌘P. Exactly one non-modifier key, last. */
export function parseChord(text: string): KeyChord {
  const parts = text.trim().toLowerCase().split('+')
  const last = parts.pop() ?? ''
  const key = KEY_ALIASES.get(last) ?? last
  const keyCode = KEY_CODES.get(key)
  const modifiers = parts.map((p) => MODIFIER_ALIASES.get(p))
  if (keyCode === undefined || modifiers.some((m) => m === undefined))
    throw new UnknownKeyError(text)
  return { modifiers: MODIFIER_ORDER.filter((m) => modifiers.includes(m)), key, keyCode }
}

export function chordLabel(chord: KeyChord): string {
  const key = KEY_SYMBOLS[chord.key] ?? chord.key.toUpperCase()
  return chord.modifiers.map((m) => MODIFIER_SYMBOLS[m]).join('') + key
}
