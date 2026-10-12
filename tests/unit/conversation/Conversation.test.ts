import { describe, it, expect } from 'vitest'
import { titleFor } from '../../../src/main/domain/conversation/model/Conversation'

describe('titleFor', () => {
  it('should keep a short instruction whole', () => {
    expect(titleFor('what is on my calendar today?')).toBe('what is on my calendar today?')
  })

  it('should cut a long instruction on a word boundary', () => {
    const long =
      'sort my downloads folder and put every invoice into documents and every screenshot into images'
    const title = titleFor(long)
    expect(title.length).toBeLessThanOrEqual(61)
    expect(title.endsWith('…')).toBe(true)
    expect(title).not.toMatch(/\s…$/)
    expect(long.startsWith(title.slice(0, -1))).toBe(true)
    // Only true when the cut landed on a boundary: a mid-word cut is not
    // followed by a space in the original.
    expect(long.startsWith(`${title.slice(0, -1)} `)).toBe(true)
  })

  it('should collapse whitespace so a pasted instruction stays one line', () => {
    expect(titleFor('  remind   me\n  at four  ')).toBe('remind me at four')
  })

  it('should fall back when the instruction is empty', () => {
    expect(titleFor('   ')).toBe('New conversation')
  })

  it('should cut a single unbroken word rather than return nothing', () => {
    const title = titleFor('x'.repeat(200))
    expect(title).toBe('x'.repeat(60) + '…')
  })
})
