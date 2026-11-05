import { useEffect, useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { BotAvatar } from '@features/bots/BotAvatar'
import type { RosterBackend } from '@features/bots/data'
import { loadDetails } from '@features/bots/details'
import type { ProfileDetails } from '@features/bots/details'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Bot } from '@features/bots/types'
import { reportError } from '@shared/lib/report'
import type { TranslationKey } from '@shared/lib/i18n'
import { Button } from '@shared/ui/button'

// What Talyx itself is for: asking about the other bots and handing them work.
const MANAGER_STARTERS: TranslationKey[] = ['starter.working', 'starter.brief', 'starter.askBot']

/**
 * A chat with no messages yet: who the bot is (its description and model) and a few ways to
 * start. A starter fills the composer, never sends; a bot without a description offers to add one.
 */
export function ChatIntro({
  bot,
  roster,
  onStart
}: {
  bot: Bot
  roster: RosterBackend | null
  onStart: (text: string) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [details, setDetails] = useState<ProfileDetails | null>(null)
  useEffect(() => {
    if (!roster) return
    let live = true
    loadDetails(roster, bot.name)
      .then((loaded) => live && setDetails(loaded))
      // The intro still works without them: the roster's description, no model line.
      .catch((error: unknown) => reportError('chat', error))
    return () => {
      live = false
    }
  }, [roster, bot.name])

  const description = (details?.description ?? bot.meta.description ?? bot.description ?? '').trim()
  const starters =
    bot.name === 'default'
      ? MANAGER_STARTERS.map((key) => t(key))
      : [
          t('starter.help'),
          ...(description
            ? [t('starter.withDescription').replace('{description}', description)]
            : [])
        ]
  return (
    <div className="grid flex-1 place-content-center justify-items-center gap-3 px-8 text-center">
      <BotAvatar bot={bot} place="tile" size={64} />
      <h1 className="text-2xl font-semibold">{botTitle(bot)}</h1>
      {description ? (
        <p className="max-w-md text-base">{description}</p>
      ) : (
        bot.name !== 'default' && (
          <Button variant="ghost" onClick={() => useRoster.getState().editProfile(bot.name)}>
            {t('chat.addDescription')}
          </Button>
        )
      )}
      {details?.model && (
        <p className="text-sm text-muted-foreground">
          {details.model.provider} · {details.model.model}
        </p>
      )}
      <Starters starters={starters} onStart={onStart} />
    </div>
  )
}

/** Starter prompts as pills; each one fills the composer for the user to finish and send. */
export function Starters({
  starters,
  onStart
}: {
  starters: string[]
  onStart: (text: string) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <ul
      aria-label={t('starter.label')}
      className="mt-3 flex max-w-xl flex-wrap justify-center gap-2"
    >
      {starters.map((starter) => (
        <li key={starter}>
          <Button
            variant="secondary"
            className="h-auto min-h-9 bg-secondary whitespace-normal hover:bg-foreground/10"
            onClick={() => onStart(starter)}
          >
            {starter}
          </Button>
        </li>
      ))}
    </ul>
  )
}
