import { toast } from 'sonner'
import { ProvidersError } from '@features/providers/providers'
import type { TranslationKey } from '@shared/lib/i18n'

export type Translate = (key: TranslationKey) => string

export function failureText(t: Translate, error: unknown): string {
  if (error instanceof ProvidersError)
    return error.detail ? `${t(error.key)} ${error.detail}` : t(error.key)
  return error instanceof Error ? error.message : String(error)
}

/** A change made on every bot: names the bots that did not take it, else confirms. */
export function reportSpread(t: Translate, failed: string[], done: TranslationKey): void {
  if (failed.length > 0) toast.error(t('providers.notOnBots').replace('{bots}', failed.join(', ')))
  else toast.success(t(done))
}
