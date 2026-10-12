import type { StoredEntry } from '@shared/api/conversation'
import type { TranscriptEntry } from './useAgent'

/** Stored entries carry the transcript entry minus its kind; this puts it back together. */
export function toTranscript(stored: StoredEntry): TranscriptEntry | null {
  if (typeof stored.payload !== 'object' || stored.payload === null) return null
  return { kind: stored.kind, ...stored.payload } as TranscriptEntry
}
