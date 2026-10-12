/** Shorter than this and a fragment rides along with its neighbour instead of its own synth call. */
export const MIN_SENTENCE_CHARS = 12

/** Captured so split() interleaves separators with content; used to tell newline breaks from punctuation ones. */
const BOUNDARY = /((?<=[.!?…])\s+|\n+)/

/** Sentence-sized chunks so the first one can play while the rest are still synthesising. */
export function splitSentences(text: string): string[] {
  const tokens = text.split(BOUNDARY)
  const sentences: string[] = []
  let boundaryWasNewline = false

  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 1) {
      boundaryWasNewline = tokens[i].includes('\n')
      continue
    }
    const part = tokens[i].trim()
    if (part.length === 0) continue

    const previous = sentences[sentences.length - 1]
    const shortFollowOn = part.length < MIN_SENTENCE_CHARS
    // A newline is a real structural break (new paragraph/line), so a short previous
    // sentence only pulls the next one in when the boundary between them was punctuation.
    const shortLeadIn =
      previous !== undefined && previous.length < MIN_SENTENCE_CHARS && !boundaryWasNewline

    if (previous !== undefined && (shortFollowOn || shortLeadIn)) {
      sentences[sentences.length - 1] = `${previous} ${part}`
    } else {
      sentences.push(part)
    }
  }
  return sentences
}
