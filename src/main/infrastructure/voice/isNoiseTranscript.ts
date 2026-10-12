/** The transcripts whisper hallucinates on silence/near-silence audio instead of returning empty. */
const SILENCE_ARTIFACTS = new Set([
  'you',
  'thank you',
  'thanks for watching',
  'thank you for watching',
  'bye',
  '[blank_audio]'
])

/**
 * True for an empty/whitespace transcript, one that is only punctuation, or one of the known
 * whisper silence artifacts — compared case-insensitively and ignoring trailing punctuation.
 */
export function isNoiseTranscript(text: string): boolean {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[.,!?\s]+$/, '')
  if (!/\p{L}|\p{N}/u.test(normalized)) return true
  return SILENCE_ARTIFACTS.has(normalized)
}
