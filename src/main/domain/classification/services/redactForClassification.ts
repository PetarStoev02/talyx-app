import type { ExtractedEntities } from '../model/SemanticResult'

/** Classification needs the first page, not the document. */
export const CLASSIFY_TEXT_BUDGET = 2000

export type ClassificationEntities = ExtractedEntities

const MASKS: Array<[keyof ClassificationEntities, string]> = [
  ['names', '[PERSON]'],
  ['organizations', '[ORG]'],
  ['amounts', '[AMOUNT]'],
  ['dates', '[DATE]'],
  ['locations', '[LOCATION]']
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Masks the entities the caller found, and nothing else, before any text
 * leaves the machine. That a document holds an amount and an organisation is
 * what files it as an invoice; the values are not needed and are not sent.
 *
 * Best-effort by construction, and the limit is the caller's: whatever it did
 * not find stays in the text verbatim. `[PERSON]` and `[LOCATION]` are in the
 * table for callers that can fill `names` and `locations` — the preview path
 * cannot, so do not read this as "personal names are masked".
 */
export function redactForClassification(text: string, entities: ClassificationEntities): string {
  // Build candidate list (value + mask pairs).
  const pairs = MASKS.flatMap(([key, mask]) =>
    entities[key].filter((value) => value.trim().length > 0).map((value) => ({ value, mask }))
  )

  // Find all match spans in the original text.
  const spans: Array<{ start: number; end: number; mask: string }> = []
  for (const { value, mask } of pairs) {
    const escaped = escapeRegExp(value)
    const regex = new RegExp(escaped, 'g')
    let match
    while ((match = regex.exec(text)) !== null) {
      spans.push({ start: match.index, end: match.index + value.length, mask })
    }
  }

  // Sort spans by start ascending, then by end descending.
  // End descending ensures longer spans at the same start come first.
  spans.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    return b.end - a.end
  })

  // Merge overlapping spans into non-overlapping regions.
  const mergedSpans: Array<{ start: number; end: number; mask: string }> = []
  let currentMerge: { start: number; end: number; mask: string } | null = null

  for (const span of spans) {
    if (currentMerge === null) {
      currentMerge = { ...span }
    } else if (span.start <= currentMerge.end) {
      // Overlapping: extend the region and keep the leftmost span's mask —
      // spans are sorted start-ascending, so currentMerge.mask is already
      // that span's mask and never changes here. The label only names the
      // placeholder; the merged region (which is what protects the data)
      // covers every absorbed span regardless of whose mask wins.
      currentMerge.end = Math.max(currentMerge.end, span.end)
    } else {
      // Non-overlapping: close current merge and start a new one.
      mergedSpans.push({
        start: currentMerge.start,
        end: currentMerge.end,
        mask: currentMerge.mask
      })
      currentMerge = { ...span }
    }
  }
  if (currentMerge !== null) {
    mergedSpans.push({ start: currentMerge.start, end: currentMerge.end, mask: currentMerge.mask })
  }

  // Rebuild the string from merged spans and untouched text between them.
  let masked = ''
  let lastPos = 0
  for (const span of mergedSpans) {
    masked += text.slice(lastPos, span.start) + span.mask
    lastPos = span.end
  }
  masked += text.slice(lastPos)

  return masked.slice(0, CLASSIFY_TEXT_BUDGET)
}
