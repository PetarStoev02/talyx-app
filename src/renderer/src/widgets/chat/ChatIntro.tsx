import { useEffect } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { BotAvatar } from '@features/bots/BotAvatar'
import type { RosterBackend } from '@features/bots/data'
import { loadDetails, useProfileDetails } from '@features/bots/details'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { Bot } from '@features/bots/types'
import { reportError } from '@shared/lib/report'
import type { TranslationKey } from '@shared/lib/i18n'
import { Button } from '@shared/ui/button'

/** A starter prompt: a whole question is sent at once; an open one fills the box to finish. */
export interface Starter {
  text: string
  send: boolean
}

// What Talyx itself is for: asking about the other bots and handing them work.
const MANAGER_STARTERS: Array<[TranslationKey, boolean]> = [
  ['starter.working', true],
  ['starter.brief', true],
  ['starter.askBot', false]
]

/**
 * A chat with no messages yet: who the bot is (its description and model) and a few ways to
 * start. A whole starter is sent on click; an open one ("Ask a bot to …") fills the composer. A
 * bot without a description offers to add one.
 */
export function ChatIntro({
  bot,
  roster,
  onStart
}: {
  bot: Bot
  roster: RosterBackend | null
  onStart: (starter: Starter) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const details = useProfileDetails((s) => s.byProfile[bot.name] ?? null)
  // Read again after a save drops them, so the intro shows what was just saved.
  const missing = !details
  useEffect(() => {
    if (!roster || !missing) return
    // The intro still works without them: the roster's description, no model line.
    loadDetails(roster, bot.name).catch((error: unknown) => reportError('chat', error))
  }, [roster, bot.name, missing])

  // An empty profile description falls back to what the roster knows.
  const description = (details?.description || bot.meta.description || bot.description || '').trim()
  const starters =
    bot.name === 'default'
      ? MANAGER_STARTERS.map(([key, send]) => ({ text: t(key), send }))
      : [
          { text: t('starter.help'), send: true },
          ...(description
            ? [
                {
                  text: t('starter.withDescription').replace('{description}', description),
                  send: true
                }
              ]
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

/** Starter prompts as pills (see Starter for what a click does). */
export function Starters({
  starters,
  onStart
}: {
  starters: Starter[]
  onStart: (starter: Starter) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <ul
      aria-label={t('starter.label')}
      className="mt-3 flex max-w-xl flex-wrap justify-center gap-2"
    >
      {starters.map((starter) => (
        <li key={starter.text}>
          <Button
            variant="secondary"
            className="h-auto min-h-9 bg-secondary whitespace-normal hover:bg-foreground/10"
            onClick={() => onStart(starter)}
          >
            {starter.text}
          </Button>
        </li>
      ))}
    </ul>
  )
}
