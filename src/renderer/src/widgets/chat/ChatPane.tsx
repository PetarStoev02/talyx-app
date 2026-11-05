import { useEffect, useRef } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { BotAvatar } from '@features/bots/BotAvatar'
import { botChatId, botTitle } from '@features/bots/roster'
import type { Bot } from '@features/bots/types'
import type { ChatActions } from '@features/chat/chat'
import { useChat } from '@features/chat/store'
import type { ChatItem } from '@features/chat/types'
import { useRefocus } from '@shared/hooks/useRefocus'
import type { TranslationKey } from '@shared/lib/i18n'
import { ApprovalCard } from './ApprovalCard'
import { ClarifyCard } from './ClarifyCard'
import { ChatChips, Composer } from './Composer'
import type { ComposerTarget } from './Composer'
import { Transcript } from './Transcript'

/** A bot's chat: its transcript with any open cards below, then the composer. */
export function ChatPane({
  bot,
  avatar,
  actions
}: {
  bot: Bot
  // The bot's large avatar for the empty chat; the page draws it.
  avatar: React.ReactNode
  actions: ChatActions | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const chat = useChat((state) => state.chats[bot.name])
  const title = botTitle(bot)
  const chatId = botChatId(bot)
  const composer = useRef<HTMLTextAreaElement>(null)
  // An answered card unmounts with focus on it; the composer is where the conversation goes on.
  useRefocus(composer, chat?.transcript?.prompts.length)

  // The roster learns the chat id after the first send; the open chat already has it.
  useEffect(() => {
    if (actions && !useChat.getState().chats[bot.name]?.sessionId)
      void actions.open(bot.name, chatId)
  }, [actions, bot.name, chatId])

  if (!actions || !chat || (chat.loading && !chat.transcript))
    return <p className="m-auto text-base text-muted-foreground">{t('chat.loading')}</p>

  const items = chat.transcript?.items ?? []
  const prompts = chat.transcript?.prompts ?? []
  const loadImage = (path: string): Promise<string> => actions.mediaUrl(bot.name, path)
  const announced = announcement(items, prompts.length, chat.transcript?.running === true)
  const target: ComposerTarget = {
    placeholder: t('chat.placeholder').replace('{name}', title),
    running: chat.transcript?.running === true,
    send: ({ text, files }) =>
      actions.send(bot.name, {
        text,
        images: files.map((file) => ({ path: file.id, mime: file.mime }))
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
      {items.length || prompts.length ? (
        <Transcript items={items} loadImage={loadImage}>
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
        <div className="grid flex-1 place-content-center justify-items-center gap-4 px-8 text-center">
          {avatar}
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="max-w-sm text-base">{t('chat.empty')}</p>
        </div>
      )}
      {chat.error && (
        <div className="mx-auto w-full max-w-3xl px-6 pb-2 text-base" role="alert">
          <p className="text-destructive-text">
            {t('chat.errorTitle')}{' '}
            <button
              className="underline underline-offset-4 hover:decoration-2"
              onClick={() => void actions.open(bot.name, chat.sessionId ?? chatId)}
            >
              {t('action.tryAgain')}
            </button>
          </p>
          <p className="text-sm text-muted-foreground wrap-anywhere">{chat.error}</p>
        </div>
      )}
      {target.running && !prompts.length && (
        <p className="mx-auto flex w-full max-w-3xl items-center gap-2 px-6 pb-2 text-sm text-muted-foreground">
          <BotAvatar bot={bot} place="row" speaking />
          {t('chat.typing').replace('{name}', title)}
        </p>
      )}
      {/* Always mounted, so a screen reader hears each change: typing, a card, a reply. */}
      <p className="sr-only" role="status">
        {announced && t(announced).replace('{name}', title)}
      </p>
      <Composer target={target} inputRef={composer}>
        <ChatChips chat={chat} actions={actions} />
      </Composer>
    </>
  )
}

// What the status line says for the newest turn; the first render's text is never read out.
function announcement(items: ChatItem[], prompts: number, running: boolean): TranslationKey | null {
  if (prompts) return 'chat.waiting'
  if (running) return 'chat.typing'
  const last = items.at(-1)
  if (last?.kind !== 'bot') return null
  return last.error ? 'chat.replyFailedAnnounce' : 'chat.replied'
}
