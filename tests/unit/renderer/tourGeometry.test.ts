import { describe, it, expect } from 'vitest'
import {
  placeCard,
  highlightFor,
  HIGHLIGHT_PAD,
  CARD_GAP,
  VIEWPORT_MARGIN
} from '../../../src/renderer/src/widgets/tour/geometry'

const viewport = { width: 1200, height: 800 }
const card = { width: 320, height: 160 }

describe('highlightFor', () => {
  it('should pad the target on every side', () => {
    expect(highlightFor({ top: 100, left: 200, width: 50, height: 20 })).toEqual({
      top: 100 - HIGHLIGHT_PAD,
      left: 200 - HIGHLIGHT_PAD,
      width: 50 + 2 * HIGHLIGHT_PAD,
      height: 20 + 2 * HIGHLIGHT_PAD
    })
  })
})

describe('placeCard', () => {
  it('should sit below the target when there is room', () => {
    const target = { top: 100, left: 300, width: 200, height: 40 }
    const pos = placeCard(target, card, viewport)
    expect(pos.top).toBe(100 + 40 + HIGHLIGHT_PAD + CARD_GAP)
    expect(pos.left).toBe(300)
  })

  it('should flip above the target near the bottom edge', () => {
    const target = { top: 720, left: 300, width: 200, height: 40 }
    const pos = placeCard(target, card, viewport)
    expect(pos.top).toBe(720 - HIGHLIGHT_PAD - CARD_GAP - card.height)
  })

  it('should clamp to the right edge', () => {
    const target = { top: 100, left: 1100, width: 80, height: 40 }
    const pos = placeCard(target, card, viewport)
    expect(pos.left).toBe(viewport.width - VIEWPORT_MARGIN - card.width)
  })

  it('should never go past the top-left margin', () => {
    const target = { top: 4, left: 2, width: 10, height: 10 }
    const pos = placeCard(target, { width: 320, height: 900 }, viewport)
    expect(pos.top).toBe(VIEWPORT_MARGIN)
    expect(pos.left).toBe(VIEWPORT_MARGIN)
  })
})
