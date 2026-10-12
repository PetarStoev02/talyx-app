import { useEffect } from 'react'
import { create } from 'zustand'
import { settingsApi } from '@shared/api/ipc'

interface VoiceModeStore {
  /** Voice: you talk, the orb answers out loud, nothing is printed. Chat: typed, silent. */
  voiceMode: boolean
  /** Flips the switch and persists it; the other window picks it up on focus. */
  setVoiceMode: (voiceMode: boolean) => void
  /** Re-reads the stored value — on mount, and whenever this window regains focus. */
  sync: () => void
}

export const useVoiceMode = create<VoiceModeStore>((set) => ({
  voiceMode: false,
  setVoiceMode: (voiceMode) => {
    set({ voiceMode })
    void settingsApi.set({ voiceMode })
  },
  sync: () => {
    settingsApi
      .get()
      .then((settings) => set({ voiceMode: settings.voiceMode === true }))
      .catch(() => {})
  }
}))

/**
 * Keeps this window's switch honest: the overlay is created once and only hidden,
 * so a change made in Settings has to reach it without a restart.
 */
export function useVoiceModeSync(): boolean {
  const voiceMode = useVoiceMode((s) => s.voiceMode)
  const sync = useVoiceMode((s) => s.sync)

  useEffect(() => {
    sync()
    window.addEventListener('focus', sync)
    return () => window.removeEventListener('focus', sync)
  }, [sync])

  return voiceMode
}
