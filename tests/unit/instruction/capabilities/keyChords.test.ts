import { describe, it, expect } from 'vitest'
import {
  chordLabel,
  parseChord
} from '../../../../src/main/domain/instruction/capabilities/keyChords'
import { UnknownKeyError } from '../../../../src/main/domain/instruction/model/errors'

describe('parseChord', () => {
  it.each([
    ['return', [], 36, '↩'],
    ['cmd+s', ['cmd'], 1, '⌘S'],
    ['Cmd+Shift+P', ['shift', 'cmd'], 35, '⇧⌘P'],
    ['ctrl+alt+delete', ['ctrl', 'alt'], 51, '⌃⌥⌫'],
    ['command+option+escape', ['alt', 'cmd'], 53, '⌥⌘⎋'],
    ['cmd+space', ['cmd'], 49, '⌘Space'],
    ['f5', [], 96, 'F5'],
    ['cmd+,', ['cmd'], 43, '⌘,']
  ])('should read %s', (text, modifiers, keyCode, label) => {
    const chord = parseChord(text)
    expect(chord.modifiers).toEqual(modifiers)
    expect(chord.keyCode).toBe(keyCode)
    expect(chordLabel(chord)).toBe(label)
  })

  it('should list modifiers in menu order however they were typed', () => {
    expect(parseChord('cmd+shift+4').modifiers).toEqual(['shift', 'cmd'])
  })

  it.each([
    '',
    'cmd+',
    'cmd+shift',
    'cmd+banana',
    'hyper+a',
    'a+b',
    'constructor+a',
    'cmd+constructor'
  ])('should reject %j', (text) => {
    expect(() => parseChord(text)).toThrow(UnknownKeyError)
  })
})
