import { describe, it, expect } from 'vitest'
import { splitSentences } from '../../../src/main/infrastructure/voice/splitSentences'

describe('splitSentences', () => {
  it('should split on sentence terminators', () => {
    expect(splitSentences('Tomorrow is clear. Nothing on your calendar! Anything else?')).toEqual([
      'Tomorrow is clear.',
      'Nothing on your calendar!',
      'Anything else?'
    ])
  })

  it('should split on newlines and ellipses', () => {
    expect(splitSentences('First line\nSecond line… and the rest.')).toEqual([
      'First line',
      'Second line…',
      'and the rest.'
    ])
  })

  it('should merge fragments too short to be worth a synth call', () => {
    expect(splitSentences('Yes. The files are in Downloads now.')).toEqual([
      'Yes. The files are in Downloads now.'
    ])
    expect(splitSentences('The files are in Downloads now. Done.')).toEqual([
      'The files are in Downloads now. Done.'
    ])
  })

  it('should keep a single long sentence whole', () => {
    const long = 'This sentence has no terminator and just keeps going for a while'
    expect(splitSentences(long)).toEqual([long])
  })

  it('should return nothing for empty or whitespace input', () => {
    expect(splitSentences('')).toEqual([])
    expect(splitSentences('  \n ')).toEqual([])
  })
})
