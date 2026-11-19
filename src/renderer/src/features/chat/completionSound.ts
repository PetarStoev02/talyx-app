import { settingsApi } from '@shared/api/ipc'
import { playChime } from '@shared/lib/chime'
import { useCompletionSound } from './store'

/** Reads the saved choice. */
export async function loadCompletionSound(): Promise<void> {
  useCompletionSound.setState({ enabled: (await settingsApi.get()).completionSound })
}

/** Saves the choice and shows what was saved. */
export async function setCompletionSound(next: boolean): Promise<void> {
  const saved = await settingsApi.set({ completionSound: next })
  useCompletionSound.setState({ enabled: saved.completionSound })
}

/** A bot finished a reply: chime when the user asked for it. */
export function replyFinished(): void {
  if (useCompletionSound.getState().enabled) playChime()
}
