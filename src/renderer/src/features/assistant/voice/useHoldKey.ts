import { useEffect } from 'react'
import { matchesHotkey, type VoiceHotkey } from './hotkey'

/** Hold to talk. `globalShortcut` has no key-up, so this binds the focused window. */
export function useHoldKey({
  hotkey,
  enabled,
  onPress,
  onRelease
}: {
  hotkey: VoiceHotkey
  enabled: boolean
  onPress: () => void
  onRelease: () => void
}): void {
  useEffect(() => {
    if (!enabled) return

    function down(event: KeyboardEvent): void {
      if (event.repeat || !matchesHotkey(event, hotkey)) return
      event.preventDefault() // ⌥Space would otherwise type a non-breaking space
      onPress()
    }
    function up(event: KeyboardEvent): void {
      if (event.code !== 'Space') return
      onRelease()
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [hotkey, enabled, onPress, onRelease])
}
