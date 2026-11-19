import { playChime } from '@shared/lib/chime'
import { useCompletionSound } from './store'

/** Where the choice is saved: the app's settings. */
export interface CompletionSoundBackend {
  get: () => Promise<{ completionSound: boolean }>
  set: (change: { completionSound: boolean }) => Promise<{ completionSound: boolean }>
}

/** Reads the saved choice. */
export async function loadCompletionSound(backend: CompletionSoundBackend): Promise<void> {
  useCompletionSound.setState({ enabled: (await backend.get()).completionSound })
}

/** Saves the choice and shows what was saved. */
export async function setCompletionSound(
  backend: CompletionSoundBackend,
  next: boolean
): Promise<void> {
  const saved = await backend.set({ completionSound: next })
  useCompletionSound.setState({ enabled: saved.completionSound })
}

/** A bot finished a reply: chime when the user asked for it. */
export function replyFinished(): void {
  if (useCompletionSound.getState().enabled) playChime()
}
