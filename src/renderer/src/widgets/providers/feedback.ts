import { toast } from 'sonner'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import { ProvidersError } from '@features/providers/providers'
import type { TranslationKey } from '@shared/lib/i18n'
import { listOf } from '@shared/lib/list'

export type Translate = (key: TranslationKey) => string

// A failure the providers code did not name still says what to do; the engine's text follows.
export function failureText(t: Translate, error: unknown): string {
  if (error instanceof ProvidersError)
    return error.detail ? `${t(error.key)} ${error.detail}` : t(error.key)
  const detail = error instanceof Error ? error.message : String(error)
  return `${t('roster.errorUnexpected')} ${detail}`
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
