export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export const HIGHLIGHT_PAD = 8
export const CARD_GAP = 12
export const VIEWPORT_MARGIN = 16

/** The cut-out drawn around a target: the target plus a little air. */
export function highlightFor(target: Rect): Rect {
  return {
    top: target.top - HIGHLIGHT_PAD,
    left: target.left - HIGHLIGHT_PAD,
    width: target.width + 2 * HIGHLIGHT_PAD,
    height: target.height + 2 * HIGHLIGHT_PAD
  }
}

/** Below the highlight when it fits, else above; always inside the viewport margin. */
export function placeCard(target: Rect, card: Size, viewport: Size): { top: number; left: number } {
  const box = highlightFor(target)
  const below = box.top + box.height + CARD_GAP
  const above = box.top - CARD_GAP - card.height
  const fitsBelow = below + card.height <= viewport.height - VIEWPORT_MARGIN
  const top = fitsBelow ? below : above
  const left = target.left
  return {
    top: clamp(top, VIEWPORT_MARGIN, viewport.height - VIEWPORT_MARGIN - card.height),
    left: clamp(left, VIEWPORT_MARGIN, viewport.width - VIEWPORT_MARGIN - card.width)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
