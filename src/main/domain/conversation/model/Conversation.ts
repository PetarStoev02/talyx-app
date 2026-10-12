/** One saved exchange with the assistant, listed newest first. */
export interface Conversation {
  id: string
  title: string
  startedAt: number
  updatedAt: number
}

/** The same set the renderer's TranscriptEntry uses, so what is shown is what is stored. */
export type ConversationEntryKind = 'user' | 'assistant' | 'card' | 'action' | 'error'

export interface ConversationEntry {
  kind: ConversationEntryKind
  /** The renderer's transcript entry, minus its kind. */
  payload: unknown
}

export const MAX_TITLE_LENGTH = 60
const FALLBACK_TITLE = 'New conversation'

/**
 * A conversation is named after what was asked first. A substring costs nothing;
 * asking a model to name it would cost a round trip on the owner's account.
 */
export function titleFor(instruction: string): string {
  const flat = instruction.trim().replace(/\s+/g, ' ')
  if (flat.length === 0) return FALLBACK_TITLE
  if (flat.length <= MAX_TITLE_LENGTH) return flat

  const cut = flat.slice(0, MAX_TITLE_LENGTH)
  const lastSpace = cut.lastIndexOf(' ')
  // A single unbroken word has no space to cut on, so take the hard cut.
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`
}
