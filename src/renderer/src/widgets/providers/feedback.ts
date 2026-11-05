import { toast } from 'sonner'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { TranslationKey } from '@shared/lib/i18n'
import { listOf } from '@shared/lib/list'
import { problemOf, problemText } from '@shared/lib/problem'

export type Translate = (key: TranslationKey) => string

// A failure as one line: what failed and what to do, then the underlying text.
export function failureText(t: Translate, error: unknown): string {
  return problemText(t, problemOf(error))
}

const SPREAD: Record<'saved' | 'removed', { done: TranslationKey; partial: TranslationKey }> = {
  saved: { done: 'providers.saved', partial: 'providers.notOnBots' },
  removed: { done: 'providers.removed', partial: 'providers.stillOnBots' }
}

/** A change made on every bot: names the bots that did not take it, else confirms. */
export function reportSpread(t: Translate, failed: string[], change: 'saved' | 'removed'): void {
  const { done, partial } = SPREAD[change]
  if (failed.length === 0) return void toast.success(t(done))
  const bots = useRoster.getState().snapshot.bots
  const titles = failed.map((profile) => {
    const bot = bots.find((item) => item.name === profile)
    return bot ? botTitle(bot) : profile
  })
  toast.error(t(partial).replace('{bots}', listOf(titles)), { duration: Infinity })
}
