import { create } from 'zustand'
import { voiceApi } from '@shared/api/voice'

interface SpeakingStore {
  /** True while Talyx is actually playing audio — drives the orb, not a guess. */
  speaking: boolean
  /** Call once per window; returns the unsubscribe. */
  subscribe: () => () => void
}

export const useSpeaking = create<SpeakingStore>((set) => ({
  speaking: false,
  // Both speakers report independently, so the same value can arrive twice; only
  // a real change should re-render the orb.
  subscribe: () =>
    voiceApi.onSpeaking((speaking) =>
      set((state) => (state.speaking === speaking ? state : { speaking }))
    )
}))
