import type { ConversationEntry } from '../model/Conversation'

const HEADING = 'Earlier in this conversation:'

function textOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const text = (payload as { text?: unknown }).text
  return typeof text === 'string' && text.trim().length > 0 ? text : null
}

/**
 * The earlier conversation in the owner's own words, to put in front of the next
 * instruction. Interim narration, cards and errors are left out: they were for
 * the screen, and repeating them would only crowd the context.
 */
export function replayText(entries: ConversationEntry[]): string {
  const lines: string[] = []

  for (const entry of entries) {
    if (entry.kind === 'user') {
      const text = textOf(entry.payload)
      if (text) lines.push(`You: ${text}`)
    } else if (entry.kind === 'assistant') {
      const interim = (entry.payload as { interim?: unknown } | null)?.interim === true
      const text = textOf(entry.payload)
      if (text && !interim) lines.push(`Talyx: ${text}`)
    } else if (entry.kind === 'action') {
      const payload = entry.payload as { label?: unknown; ok?: unknown } | null
      const label = typeof payload?.label === 'string' ? payload.label : null
      if (label) lines.push(`Talyx did: ${label}${payload?.ok === false ? ' (failed)' : ''}`)
    }
  }

  return lines.length === 0 ? '' : `${HEADING}\n${lines.join('\n')}`
}
