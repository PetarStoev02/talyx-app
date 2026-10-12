import { phonemize } from 'phonemizer'

/** A run of punctuation, with surrounding spaces, kept verbatim between word runs. */
const PUNCTUATION_RUN = /(\s*[;:,.!?¡¿—…"«»“”(){}[\]]+\s*)+/g

/** Kokoro voice ids start with the language: `a` American, `b` British. */
export function kokoroLanguage(voice: string): 'en' | 'en-us' {
  return voice.startsWith('b') ? 'en' : 'en-us'
}

/**
 * Punctuation is what gives Kokoro its pauses; phonemising the whole string drops it.
 * So: split on punctuation, phonemise the words, put the punctuation back.
 */
export async function phonemizeForKokoro(text: string, voice: string): Promise<string> {
  const language = kokoroLanguage(voice)
  let out = ''
  let cursor = 0

  for (const match of text.matchAll(PUNCTUATION_RUN)) {
    const start = match.index ?? 0
    if (start > cursor) out += await words(text.slice(cursor, start), language)
    out += match[0]
    cursor = start + match[0].length
  }
  if (cursor < text.length) out += await words(text.slice(cursor), language)

  return fixups(out).trim()
}

async function words(chunk: string, language: 'en' | 'en-us'): Promise<string> {
  return (await phonemize(chunk, language)).join(' ')
}

/** The four substitutions kokoro-js applies so the tokenizer sees the symbols it was trained on. */
function fixups(phonemes: string): string {
  return phonemes.replace(/ʲ/g, 'j').replace(/r/g, 'ɹ').replace(/x/g, 'k').replace(/ɬ/g, 'l')
}
