import { toast } from 'sonner'
import type { TranslationKey } from '@shared/lib/i18n'
import { listOf } from '@shared/lib/list'
import { problemOf, problemText } from '@shared/lib/problem'
import { botTitle } from './roster'
import { useRoster } from './store'

type Translate = (key: TranslationKey) => string

// `done` is null when the caller already said what changed.
const SPREAD: Record<
  'saved' | 'removed' | 'followed',
  { done: TranslationKey | null; partial: TranslationKey }
> = {
  saved: { done: 'providers.saved', partial: 'providers.notOnBots' },
  removed: { done: 'providers.removed', partial: 'providers.stillOnBots' },
  followed: { done: null, partial: 'providers.notFollowing' }
}

/** A change made on several bots: names the bots that did not take it, else confirms. */
export function reportSpread(
  t: Translate,
  failed: string[],
  change: 'saved' | 'removed' | 'followed'
): void {
  const { done, partial } = SPREAD[change]
  if (failed.length === 0) return void (done && toast.success(t(done)))
  toast.error(t(partial).replace('{bots}', titlesOf(failed)), { duration: Infinity })
}

/** Bots still on a model their endpoint no longer lists: they keep it until someone picks. */
export function reportFlagged(t: Translate, model: string, profiles: string[]): void {
  if (profiles.length === 0) return
  const text = t('providers.modelStillUsed').replace('{model}', model)
  toast.warning(text.replace('{bots}', titlesOf(profiles)), { duration: Infinity })
}

function titlesOf(profiles: string[]): string {
  const bots = useRoster.getState().snapshot.bots
  return listOf(
    profiles.map((profile) => {
      const bot = bots.find((item) => item.name === profile)
      return bot ? botTitle(bot) : profile
    })
  )
}

/** Reports a move of the bots on "Uses default": the ones left behind, or why none were reached. */
export async function reportFollowing(t: Translate, following: Promise<string[]>): Promise<void> {
  try {
    reportSpread(t, await following, 'followed')
  } catch (error) {
    toast.error(problemText(t, problemOf(error)), { duration: Infinity })
  }
}
