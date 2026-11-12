import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { useNavigation } from '@app/providers/useNavigation'
import { botChatId, botTitle } from '@features/bots/roster'
import type { RosterBackend } from '@features/bots/data'
import { MANAGER } from '@features/bots/details'
import type { Bot } from '@features/bots/types'
import type { ChatActions } from '@features/chat/chat'
import { useChat } from '@features/chat/store'
import { useSetup } from '@features/setup/store'
import { turnView } from '@features/chat/turns'
import type { MessageItem } from '@features/chat/types'
import { openSettings } from '@features/settings/sections'
import { useRefocus } from '@shared/hooks/useRefocus'
import type { TranslationKey } from '@shared/lib/i18n'
import { ActivityLine } from './ActivityLine'
import { ApprovalCard } from './ApprovalCard'
import { ClarifyCard } from './ClarifyCard'
import { ChatChips, Composer } from './Composer'
import type { ComposerTarget } from './Composer'
import { ChatIntro } from './ChatIntro'
import type { Starter } from './ChatIntro'
import { ChatSkeleton } from './ChatSkeleton'
import { Button } from '@shared/ui/button'
import { Reveal } from '@shared/ui/Reveal'
import { useArrival } from '@shared/hooks/useStayMounted'
import { cn } from '@shared/lib/utils'
import { Transcript } from './Transcript'

/** A bot's chat: its transcript with any open cards below, then the composer. */
export function ChatPane({
  bot,
  roster,
  actions
}: {
  bot: Bot
  // Reads the bot's description and model for the intro before its first message.
  roster: RosterBackend | null
  actions: ChatActions | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const chat = useChat((state) => state.chats[bot.name])
  // Unknown (null) stays quiet: only a provider list read as empty asks for one.
  const noProvider = useSetup((s) => s.hasProvider === false) && bot.name === MANAGER
  const navigate = useNavigation((s) => s.navigate)
  const title = botTitle(bot)
  const chatId = botChatId(bot)
  const composer = useRef<HTMLTextAreaElement>(null)
  const [seed, setSeed] = useState<{ text: string } | null>(null)
  const start = (starter: Starter): void => {
    if (starter.send) return void actions?.send(bot.name, { text: starter.text, images: [] })
    setSeed({ text: starter.text })
    // After the composer has the text: the cursor goes to its end, ready to finish the sentence.
    requestAnimationFrame(() => {
      composer.current?.focus()
      composer.current?.setSelectionRange(starter.text.length, starter.text.length)
    })
  }
  // An answered card unmounts with focus on it; the composer is where the conversation goes on.
  useRefocus(composer, chat?.transcript?.prompts.length)

  // The roster learns the chat id after the first send; the open chat already has it.
  useEffect(() => {
    if (actions && !useChat.getState().chats[bot.name]?.sessionId)
      void actions.open(bot.name, chatId)
  }, [actions, bot.name, chatId])

  const loading = !actions || !chat || (chat.loading && !chat.transcript)
  // A chat that had to load fades in; one already loaded shows at once when you switch to it.
  const arrival = useArrival(loading)
  if (loading) return <ChatSkeleton label={t('chat.loading')} />

  const running = chat.transcript?.running === true
  const { items, activity } = turnView(chat.transcript?.items ?? [], running)
  const prompts = chat.transcript?.prompts ?? []
  const loadImage = (path: string): Promise<string> => actions.mediaUrl(bot.name, path)
  const announced = announcement(items, prompts.length, running)
  const target: ComposerTarget = {
    placeholder: t('chat.placeholder').replace('{name}', title),
    running,
    send: ({ text, files, queued }) =>
      actions.send(bot.name, {
        text,
        images: files.map((file) => ({ path: file.id, mime: file.mime })),
        // Sent while the bot answers: it waits for that answer instead of redirecting it.
        ...(queued ? { whenBusy: 'queue' as const } : {})
      }),
    upload: async (file, dataUrl) => {
      const image = await actions.uploadImage(bot.name, { dataUrl, name: file.name })
      return { id: image.path, name: file.name, mime: image.mime, size: file.size }
    },
    transcribe: (audio) => actions.transcribe(bot.name, audio),
    stop: () => void actions.interrupt(bot.name)
  }

  return (
    <>
      <div className={cn('flex min-h-0 flex-1 flex-col', arrival)}>
        {items.length || prompts.length ? (
          <Transcript items={items} loadImage={loadImage}>
            {activity && (
              <li>
                <ActivityLine bot={bot} activity={activity} wait={chat.transcript?.wait ?? null} />
              </li>
            )}
            {prompts.map((prompt) => (
              <li key={prompt.id}>
                {prompt.kind === 'clarify' ? (
                  <ClarifyCard
                    prompt={prompt}
                    onAnswer={(answers) => actions.answerClarify(bot.name, prompt.id, answers)}
                  />
                ) : (
                  <ApprovalCard
                    prompt={prompt}
                    botName={title}
                    onAnswer={(choice) => actions.answerApproval(bot.name, prompt.id, choice)}
                  />
                )}
              </li>
            ))}
          </Transcript>
        ) : (
          <ChatIntro bot={bot} roster={roster} onStart={start} />
        )}
      </div>
      <Reveal value={chat.error}>
        {(error) => (
          <div className="mx-auto w-full max-w-3xl px-6 pb-2 text-base" role="alert">
            <p className="text-destructive-text">
              {t(error.key)}{' '}
              {/* Only a failed load is undone by loading again; the rest are redone where they were. */}
              {error.key === 'chat.errorLoad' && (
                <button
                  className="underline underline-offset-4 hover:decoration-2"
                  onClick={() => void actions.open(bot.name, chat.sessionId ?? chatId)}
                >
                  {t('action.tryAgain')}
                </button>
              )}
            </p>
            {error.detail && (
              <p className="text-sm text-muted-foreground wrap-anywhere">{error.detail}</p>
            )}
          </div>
        )}
      </Reveal>
      {/* Always mounted, so a screen reader hears each change: typing, a card, a reply. */}
      <p className="sr-only" role="status">
        {announced && t(announced).replace('{name}', title)}
      </p>
      {noProvider && (
        <p className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 px-6 pb-2 text-base">
          {t('chat.noProvider')}
          <Button
            variant="secondary"
            className="bg-secondary hover:bg-foreground/10"
            onClick={() => openSettings('providers', navigate)}
          >
            {t('chat.openSettings')}
          </Button>
        </p>
      )}
      <Composer target={target} inputRef={composer} seed={seed}>
        <ChatChips chat={chat} actions={actions} />
      </Composer>
    </>
  )
}

// What the status line says for the newest turn; the first render's text is never read out.
function announcement(
  items: MessageItem[],
  prompts: number,
  running: boolean
): TranslationKey | null {
  if (prompts) return 'chat.waiting'
  if (running) return 'chat.typing'
  const last = items.at(-1)
  if (last?.kind !== 'bot') return null
  return last.error ? 'chat.replyFailedAnnounce' : 'chat.replied'
}
