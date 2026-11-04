import { useEffect } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { botChatId, botTitle } from '@features/bots/roster'
import type { Bot } from '@features/bots/types'
import type { ChatActions } from '@features/chat/chat'
import { useChat } from '@features/chat/store'
import { BotAvatar } from '@widgets/roster'
import { ApprovalCard } from './ApprovalCard'
import { ClarifyCard } from './ClarifyCard'
import { Composer } from './Composer'
import { Transcript } from './Transcript'

/** A bot's chat: its transcript with any open cards below, then the composer. */
export function ChatPane({
  bot,
  actions
}: {
  bot: Bot
  actions: ChatActions | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const chat = useChat((state) => state.chats[bot.name])
  const title = botTitle(bot)
  const chatId = botChatId(bot)

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
          <BotAvatar bot={bot} size={64} />
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="max-w-sm text-base">{t('chat.empty')}</p>
        </div>
      )}
      {chat.error && (
        <p className="mx-auto w-full max-w-3xl px-6 pb-2 text-base text-destructive" role="alert">
          {chat.error}{' '}
          <button
            className="underline"
            onClick={() => void actions.open(bot.name, chat.sessionId ?? chatId)}
          >
            {t('chat.retry')}
          </button>
        </p>
      )}
      <Composer chat={chat} title={title} actions={actions} />
    </>
  )
}
