import { useCallback, useState } from 'react'
import { CircleAlert, X } from 'lucide-react'
import { useLanguage } from '@shared/lib/i18n'
import { BotAvatar } from '@features/bots/BotAvatar'
import type { ModelChoice, ProfileDetails } from '@features/bots/details'
import { botTitle } from '@features/bots/roster'
import type { Bot } from '@features/bots/types'
import { modelLeftEndpoint } from '@features/providers/providers'
import { useLoad } from '@shared/hooks/useLoad'
import type { ChatModels } from './DetailsPanel'

/** The panel's top: the bot, what it does, its model, and a notice when that model is gone. */
export function DetailsHeader({
  bot,
  loaded,
  chat,
  onClose
}: {
  bot: Bot
  loaded: ProfileDetails | null
  chat: ChatModels | null
  onClose: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const stranded = useModelLeftEndpoint(bot.name, loaded?.model ?? null, chat)
  return (
    <header className="relative flex flex-col items-center gap-2 px-6 pt-6 pb-4 text-center">
      <button
        aria-label={t('agents.closeDetails')}
        onClick={onClose}
        className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-full hover:bg-foreground/10"
      >
        <X size={16} />
      </button>
      <BotAvatar bot={bot} place="hero" />
      <h2 className="max-w-full text-xl font-semibold wrap-break-word">{botTitle(bot)}</h2>
      {/* What it does, then its model on a line of its own. */}
      <p className="text-sm text-balance text-muted-foreground">
        {loaded?.description || (!loaded?.model && bot.name)}
        {loaded?.model && (
          <span className="block text-xs">
            {loaded.model.provider} · {loaded.model.model}
          </span>
        )}
      </p>
      {/* Always in the page, so a screen reader announces the notice when it appears. */}
      <div role="status" className="text-sm text-balance text-destructive-text empty:sr-only">
        {stranded && (
          <p className="flex items-start justify-center gap-2">
            <CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
            {t('details.modelLeftEndpoint')}
          </p>
        )}
      </div>
    </header>
  )
}

/**
 * True when the bot's model is one its custom endpoint no longer lists. The bot keeps asking for
 * it, so the panel says so instead of switching it; a new pick clears it.
 */
function useModelLeftEndpoint(
  profile: string,
  model: ModelChoice | null,
  chat: ChatModels | null
): boolean {
  // The verdict names the model it is for, so a newly loaded model never shows an old verdict.
  const [verdict, setVerdict] = useState<{ model: ModelChoice; stranded: boolean } | null>(null)
  useLoad(
    useCallback(
      async () =>
        model && chat && { model, stranded: modelLeftEndpoint(model, await chat.models(profile)) },
      [profile, model, chat]
    ),
    // No list, no verdict: the model menu shows the failure when it opens.
    {
      loaded: (found) => {
        if (found) setVerdict(found)
      }
    }
  )
  return verdict?.model === model && verdict.stranded
}
