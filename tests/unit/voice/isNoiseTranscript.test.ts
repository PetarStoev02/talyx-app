import { describe, it, expect } from 'vitest'
import { isNoiseTranscript } from '../../../src/main/infrastructure/voice/isNoiseTranscript'

describe('isNoiseTranscript', () => {
  it.each([
    ['', 'empty string'],
    ['   ', 'whitespace only'],
    ['.', 'a single period'],
    ['...', 'only punctuation'],
    ['you', 'the bare "you" hallucination'],
    ['You.', 'capitalized with trailing punctuation'],
    ['thank you', 'the bare "thank you" hallucination'],
    ['Thank you.', 'capitalized with trailing period'],
    ['thanks for watching', 'the "thanks for watching" hallucination'],
    ['Thank you for watching!', 'capitalized with trailing exclamation'],
    ['bye', 'the bare "bye" hallucination'],
    ['[BLANK_AUDIO]', 'the whisper blank-audio marker']
  ])('should treat %j (%s) as noise', (text) => {
    expect(isNoiseTranscript(text)).toBe(true)
  })

  it('should not treat a real sentence as noise', () => {
    expect(isNoiseTranscript('What is on my calendar tomorrow')).toBe(false)
  })

  it('should not treat a sentence that merely contains a noise phrase as noise', () => {
    expect(isNoiseTranscript('thank you for the files in Downloads')).toBe(false)
  })

  it('should not treat a Bulgarian sentence as noise', () => {
    expect(isNoiseTranscript('Какво е в календара ми утре?')).toBe(false)
  })

  it('should not treat a single Cyrillic word as noise', () => {
    expect(isNoiseTranscript('Здравей')).toBe(false)
  })
})
