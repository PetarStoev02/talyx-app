export const VOICE_HOTKEYS = ['Alt+Space', 'Control+Space', 'Shift+Space'] as const
export type VoiceHotkey = (typeof VOICE_HOTKEYS)[number]

export interface HotkeyEvent {
  code: string
  altKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

/** Exactly one modifier plus Space; Command never participates, so ⌘Space stays Spotlight's. */
export function matchesHotkey(event: HotkeyEvent, hotkey: VoiceHotkey): boolean {
  if (event.code !== 'Space' || event.metaKey) return false
  return (
    event.altKey === (hotkey === 'Alt+Space') &&
    event.ctrlKey === (hotkey === 'Control+Space') &&
    event.shiftKey === (hotkey === 'Shift+Space')
  )
}
