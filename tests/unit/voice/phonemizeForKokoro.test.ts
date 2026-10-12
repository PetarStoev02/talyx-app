import { describe, it, expect } from 'vitest'
import {
  kokoroLanguage,
  phonemizeForKokoro
} from '../../../src/main/infrastructure/voice/phonemizeForKokoro'

describe('kokoroLanguage', () => {
  it('should pick British for b-voices and American for a-voices', () => {
    expect(kokoroLanguage('bm_lewis')).toBe('en')
    expect(kokoroLanguage('bf_emma')).toBe('en')
    expect(kokoroLanguage('af_heart')).toBe('en-us')
    expect(kokoroLanguage('am_michael')).toBe('en-us')
  })
})

describe('phonemizeForKokoro', () => {
  it('should keep punctuation in place between phonemised words', async () => {
    const out = await phonemizeForKokoro('Hello, world. How are you?', 'bm_lewis')
    expect(out).toMatch(/^h.+, w.+\. h.+\?$/)
    expect(out).not.toMatch(/[A-Za-z]{3}/) // words became IPA, not left as English
  })

  it('should use British pronunciation for a British voice and American for an American one', async () => {
    const british = await phonemizeForKokoro('Hello', 'bm_lewis')
    const american = await phonemizeForKokoro('Hello', 'af_heart')
    expect(british).toContain('əʊ')
    expect(american).toContain('oʊ')
  })

  it('should apply the character fixups Kokoro expects', async () => {
    // "red" phonemises with a plain r; Kokoro's tokenizer wants ɹ
    const out = await phonemizeForKokoro('red', 'af_heart')
    expect(out).toContain('ɹ')
    expect(out).not.toMatch(/(?<!ɹ)r/)
  })

  it('should return an empty string for empty input', async () => {
    expect(await phonemizeForKokoro('', 'bm_lewis')).toBe('')
  })
})
