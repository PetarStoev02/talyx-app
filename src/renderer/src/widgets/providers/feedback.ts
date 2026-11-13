import type { TranslationKey } from '@shared/lib/i18n'
import { problemOf, problemText } from '@shared/lib/problem'

export type Translate = (key: TranslationKey) => string

// A failure as one line: what failed and what to do, then the underlying text.
export function failureText(t: Translate, error: unknown): string {
  return problemText(t, problemOf(error))
}
