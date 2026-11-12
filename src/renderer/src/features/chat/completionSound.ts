import { create } from 'zustand'
import { settingsApi } from '@shared/api/ipc'
import { playChime } from '@shared/lib/chime'

interface CompletionSoundState {
  /** Off until the saved setting is read, so a launch never chimes against the user's choice. */
  enabled: boolean
  load: () => Promise<void>
  setEnabled: (next: boolean) => Promise<void>
}

export const useCompletionSound = create<CompletionSoundState>((set) => ({
  enabled: false,
  load: async () => set({ enabled: (await settingsApi.get()).completionSound }),
  setEnabled: async (next) =>
    set({ enabled: (await settingsApi.set({ completionSound: next })).completionSound })
}))

/** A bot finished a reply: chime when the user asked for it. */
export function replyFinished(): void {
  if (useCompletionSound.getState().enabled) playChime()
}
