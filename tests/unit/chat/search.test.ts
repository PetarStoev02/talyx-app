import { describe, expect, it } from 'vitest'
import { findMatches, pointIn } from '../../../src/renderer/src/features/chat/search'

describe('finding text in a chat', () => {
  const texts = ['Deploy the site', 'The deploy failed', 'nothing here']

  it('should find nothing for an empty or blank query', () => {
    expect(findMatches(texts, '')).toEqual([])
    expect(findMatches(texts, '   ')).toEqual([])
  })

  it('should find nothing when no text has the query', () => {
    expect(findMatches(texts, 'rollback')).toEqual([])
  })

  it('should find one match with its place in the text', () => {
    expect(findMatches(texts, 'failed')).toEqual([{ text: 1, start: 11, end: 17 }])
  })

  it('should find every match in reading order, ignoring case', () => {
    expect(findMatches(texts, 'DEPLOY')).toEqual([
      { text: 0, start: 0, end: 6 },
      { text: 1, start: 4, end: 10 }
    ])
  })

  it('should find repeats in one text without overlapping them', () => {
    expect(findMatches(['aaaa'], 'aa')).toEqual([
      { text: 0, start: 0, end: 2 },
      { text: 0, start: 2, end: 4 }
    ])
  })

  it('should match the query as typed, spaces inside it included', () => {
    expect(findMatches(texts, ' the ')).toEqual([{ text: 0, start: 6, end: 11 }])
  })

  it('should keep the place in the text when lowercasing would change its length', () => {
    expect(findMatches(['İx'], 'x')).toEqual([{ text: 0, start: 1, end: 2 }])
  })

  it('should find characters that mean something in a pattern as plain text', () => {
    expect(findMatches(['cost (net) is $5.00?'], '(net) is $5.00?')).toEqual([
      { text: 0, start: 5, end: 20 }
    ])
  })

  describe('in a paragraph split by formatting', () => {
    // "asks for a **refund** now": three text nodes, the match spans the first two.
    const lengths = ['asks for a '.length, 'refund'.length, ' now'.length]

    it('should start in the piece the match starts in, past a piece that ends there', () => {
      expect(pointIn(lengths, 9, 'start')).toEqual({ piece: 0, at: 9 })
      expect(pointIn(lengths, 11, 'start')).toEqual({ piece: 1, at: 0 })
    })

    it('should end in the piece the match ends in, before a piece that starts there', () => {
      expect(pointIn(lengths, 17, 'end')).toEqual({ piece: 1, at: 6 })
      expect(pointIn(lengths, 21, 'end')).toEqual({ piece: 2, at: 4 })
    })
  })
})
