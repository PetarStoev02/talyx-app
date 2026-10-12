import { describe, it, expect } from 'vitest'
import {
  matchesHotkey,
  type VoiceHotkey
} from '../../../src/renderer/src/features/assistant/voice/hotkey'

function key(
  over: Partial<Parameters<typeof matchesHotkey>[0]> = {}
): Parameters<typeof matchesHotkey>[0] {
  return { code: 'Space', altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, ...over }
}

describe('matchesHotkey', () => {
  it.each([
    ['Alt+Space', { altKey: true }],
    ['Control+Space', { ctrlKey: true }],
    ['Shift+Space', { shiftKey: true }]
  ] as [VoiceHotkey, Record<string, boolean>][])('should match %s', (hotkey, modifier) => {
    expect(matchesHotkey(key(modifier), hotkey)).toBe(true)
  })

  it('should not match the wrong modifier', () => {
    expect(matchesHotkey(key({ ctrlKey: true }), 'Alt+Space')).toBe(false)
  })

  it('should not match a bare space', () => {
    expect(matchesHotkey(key(), 'Alt+Space')).toBe(false)
  })

  it('should not match another key with the right modifier', () => {
    expect(matchesHotkey(key({ code: 'KeyA', altKey: true }), 'Alt+Space')).toBe(false)
  })

  it('should not match when Command is also held', () => {
    expect(matchesHotkey(key({ altKey: true, metaKey: true }), 'Alt+Space')).toBe(false)
  })
})
