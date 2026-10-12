import { describe, it, expect } from 'vitest'
import { markdownToSpeech } from '../../../src/main/infrastructure/voice/markdownToSpeech'

describe('markdownToSpeech', () => {
  it('should drop code fences entirely', () => {
    expect(markdownToSpeech('Here:\n```sh\nnpm test\n```\nDone.')).toBe('Here: Done.')
  })

  it('should read link text, not the URL', () => {
    expect(markdownToSpeech('See [the docs](https://example.com/x).')).toBe('See the docs.')
  })

  it('should strip emphasis, headings, bullets and inline code', () => {
    expect(markdownToSpeech('## Result\n\n- **two** files in `src`')).toBe(
      'Result two files in src'
    )
  })

  it('should collapse whitespace', () => {
    expect(markdownToSpeech('one\n\n\ntwo   three')).toBe('one two three')
  })

  it('should cap a long answer so the Mac does not monologue', () => {
    const spoken = markdownToSpeech('x '.repeat(1000))
    expect(spoken.length).toBe(600)
    expect(spoken.endsWith('…')).toBe(true)
  })

  it('should return an empty string for markdown that is only a code block', () => {
    expect(markdownToSpeech('```\nnpm test\n```')).toBe('')
  })
})
