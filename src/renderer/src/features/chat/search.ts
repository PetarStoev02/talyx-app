/** Where a query appears: which of the searched texts, and the span inside it. */
export interface TextMatch {
  text: number
  start: number
  end: number
}

/** A place inside a text made of pieces (a paragraph's text nodes): which piece, how far in. */
export interface PiecePoint {
  piece: number
  at: number
}

/**
 * Every place the query appears in the texts, in reading order, ignoring case. The offsets are the
 * text's own: matching never lowercases the text, since that can change its length.
 */
export function findMatches(texts: string[], query: string): TextMatch[] {
  if (!query.trim()) return []
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
  return texts.flatMap((text, index) =>
    Array.from(text.matchAll(pattern), (found) => ({
      text: index,
      start: found.index,
      end: found.index + found[0].length
    }))
  )
}

/**
 * Where an offset into the joined pieces falls. A start on the line between two pieces belongs to
 * the next one, an end to the one before, so a range never covers an empty edge of a piece.
 */
export function pointIn(lengths: number[], offset: number, edge: 'start' | 'end'): PiecePoint {
  let before = 0
  for (const [piece, length] of lengths.entries()) {
    const inside = edge === 'start' ? offset < before + length : offset <= before + length
    if (inside) return { piece, at: offset - before }
    before += length
  }
  return { piece: lengths.length - 1, at: lengths.at(-1) ?? 0 }
}
