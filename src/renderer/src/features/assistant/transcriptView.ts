import type { TranscriptEntry } from './useAgent'

/**
 * Voice mode answers out loud, so the spoken reply is not repeated on screen.
 * Everything you still need to see stays: your own instruction, result cards,
 * what was actually done, and errors.
 */
export function visibleEntries(entries: TranscriptEntry[], voiceMode: boolean): TranscriptEntry[] {
  if (!voiceMode) return entries
  return entries.filter((entry) => entry.kind !== 'assistant')
}
