import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Pencil, RefreshCw, RotateCcw, X } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { useNavigation } from '@app/providers/useNavigation'
import { botChatId, botTitle } from '@features/bots/roster'
import type { RosterBackend } from '@features/bots/data'
import { MANAGER } from '@features/bots/details'
import type { Bot } from '@features/bots/types'
import type { ChatActions } from '@features/chat/chat'
import { useChat } from '@features/chat/store'
import type { WaitingMessage } from '@features/chat/store'
import { useSetup } from '@features/setup/store'
import { turnOutcome, turnView } from '@features/chat/turns'
import type { TurnOutcome } from '@features/chat/turns'
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
      const end = composer.current?.value.length ?? 0
      composer.current?.setSelectionRange(end, end)
    })
  }
  const edit = (message: WaitingMessage): void => {
    actions?.unqueue(bot.name, message.id)
    start({ text: message.draft.text, send: false })
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
  // A retry waits for nothing else: not while a message is already lined up to go.
  const outcome = chat.waiting.length ? null : turnOutcome(chat.transcript?.items ?? [], running)
  // The engine keeps a sent image's upload only briefly, so a message with images goes back to
  // the composer to attach them again; a text message is asked again in its place.
  const retry = (asked: TurnOutcome['asked']): void => {
    if (asked.images.length) start({ text: asked.text, send: false })
    else void actions.regenerate(bot.name, asked)
  }
  const prompts = chat.transcript?.prompts ?? []
  const loadImage = (path: string): Promise<string> => actions.mediaUrl(bot.name, path)
  const announced = announcement(items, prompts.length, running, outcome)
  const target: ComposerTarget = {
    placeholder: t('chat.placeholder').replace('{name}', title),
    running,
    send: ({ text, files }) =>
      actions.queue(bot.name, {
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
      <div className={cn('flex min-h-0 flex-1 flex-col', arrival)}>
        {items.length || prompts.length || chat.waiting.length ? (
          <Transcript items={items} loadImage={loadImage}>
            {activity && (
              <li>
                <ActivityLine bot={bot} activity={activity} wait={chat.transcript?.wait ?? null} />
              </li>
            )}
            {outcome && (
              <li>
                <OutcomeLine outcome={outcome} name={title} onRetry={() => retry(outcome.asked)} />
              </li>
            )}
            {chat.waiting.map((message) => (
              <li key={message.id}>
                <WaitingBubble
                  message={message}
                  onSendNow={() => void actions.sendNow(bot.name, message.id)}
                  onEdit={message.draft.images.length ? null : () => edit(message)}
                  onRemove={() => actions.unqueue(bot.name, message.id)}
                />
              </li>
            ))}
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
        <ChatChips chat={chat} actions={actions} returnFocusTo={composer} />
      </Composer>
    </>
  )
}

// What the status line says for the newest turn; the first render's text is never read out.
function announcement(
  items: MessageItem[],
  prompts: number,
  running: boolean,
  outcome: TurnOutcome | null
): TranslationKey | null {
  if (prompts) return 'chat.waiting'
  if (running) return 'chat.typing'
  if (outcome?.kind === 'noReply') return 'chat.noReply'
  if (outcome?.kind === 'stopped') return 'chat.replyStopped'
  const last = items.at(-1)
  if (last?.kind !== 'bot') return null
  return last.error ? 'chat.replyFailedAnnounce' : 'chat.replied'
}

// How a turn ended, and a way to ask its message again: a new answer, or a retry of one that failed.
function OutcomeLine({
  outcome,
  name,
  onRetry
}: {
  outcome: TurnOutcome
  name: string
  onRetry: () => void
}): React.JSX.Element | null {
  const t = useLanguage((s) => s.t)
  const { kind, asked } = outcome
  const attach = asked.images.length > 0
  // A new answer to a message with images would need them attached again: that is a new message.
  if (kind === 'answered')
    return attach ? null : (
      <OutcomeButton
        label={t('chat.regenerateLabel').replace('{text}', asked.text)}
        onClick={onRetry}
      >
        <RefreshCw size={14} />
        {t('chat.regenerate')}
      </OutcomeButton>
    )
  const said =
    kind === 'stopped'
      ? t('chat.replyStopped')
      : kind === 'noReply'
        ? t('chat.noReply').replace('{name}', name)
        : null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-sm text-muted-foreground">
      {said && <p>{said}</p>}
      <OutcomeButton
        label={t(attach ? 'chat.retryImagesLabel' : 'chat.retryLabel').replace(
          '{text}',
          asked.text
        )}
        onClick={onRetry}
      >
        <RotateCcw size={14} />
        {t(attach ? 'chat.retryImages' : 'chat.retry')}
      </OutcomeButton>
    </div>
  )
}

function OutcomeButton({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-sm text-muted-foreground hover:bg-foreground/10"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

// A message held until the running answer ends, as a dashed bubble: send it now (stops that
// answer), take it back into the composer to edit, or drop it.
function WaitingBubble({
  message,
  onSendNow,
  onEdit,
  onRemove
}: {
  message: WaitingMessage
  onSendNow: () => void
  // Null for a message with images: the composer takes text back, not files.
  onEdit: (() => void) | null
  onRemove: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const { text, images } = message.draft
  const action = 'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-foreground/10'
  return (
    <div className="ml-auto flex max-w-[80%] flex-col items-end gap-1">
      <p
        dir="auto"
        className="rounded-3xl border border-dashed border-border px-4 py-2 text-base whitespace-pre-wrap wrap-anywhere text-muted-foreground"
      >
        {text ||
          (images.length === 1
            ? t('chat.queuedImage')
            : t('chat.queuedImages').replace('{count}', String(images.length)))}
        <span className="sr-only">{` (${t('chat.queued')})`}</span>
      </p>
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <button
          type="button"
          aria-label={`${t('chat.sendNow')}: ${text}`}
          className={action}
          onClick={onSendNow}
        >
          <ArrowUp size={14} />
          {t('chat.sendNow')}
        </button>
        {onEdit && (
          <button
            type="button"
            aria-label={`${t('chat.editQueued')}: ${text}`}
            className={action}
            onClick={onEdit}
          >
            <Pencil size={14} />
          </button>
        )}
        <button
          type="button"
          aria-label={`${t('chat.unqueue')}: ${text}`}
          className={action}
          onClick={onRemove}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
