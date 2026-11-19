import type { TranslationKey } from '@shared/lib/i18n'

export type View = 'memories' | 'skills'

// What a screen reader hears as a search narrows the list: how many are left, or that none is.
// `count` is undefined while there is no search or the list has not loaded.
export function announce(
  t: (key: TranslationKey) => string,
  count: number | undefined,
  noMatch: TranslationKey
): string {
  if (count === undefined) return ''
  return count ? t('memory.shown').replace('{count}', String(count)) : t(noMatch)
}

/** What a view tells the tab: how many it lists, once loaded. */
export type Counted = (view: View, count: number) => void
