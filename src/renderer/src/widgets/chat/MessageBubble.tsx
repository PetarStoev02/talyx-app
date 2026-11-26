import { useCallback, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useLoad } from '@shared/hooks/useLoad'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import type { Components, UrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useLanguage, type TranslationKey } from '@shared/lib/i18n'
import { BotAvatar } from '@features/bots/BotAvatar'
import { botTitle, unknownBot } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import { markdownImage } from '@features/chat/markdownImage'
import { replyFailure } from '@features/chat/replyFailure'
import { senderProfile } from '@features/chat/transcript'
import type { Asker } from '@features/chat/turns'
import type { ChatItem, MessageItem } from '@features/chat/types'
import { SurfaceCard } from './SurfaceCard'
import { parseBrief, parseStop, splitReply } from '@features/chat/workflowLines'
import type { WorkflowBrief } from '@features/chat/workflowLines'
import { cn } from '@shared/lib/utils'
import { CodeBlock } from './CodeBlock'
import { useManagerName } from './useManagerName'
import { WorkflowBriefCard, WorkflowStatusRow } from './WorkflowParts'

// Links open in the browser through the window-open guard, never inside the app.
const MARKDOWN_COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  img: ({ src, alt }) => {
    const image = markdownImage(typeof src === 'string' ? src : '', alt ?? '')
    if (image.kind === 'image') return <img src={image.src} alt={alt} />
    if (image.kind === 'link')
      return (
        <a href={image.href} target="_blank" rel="noreferrer">
          {image.label}
        </a>
      )
    return <>{image.label}</>
  }
}

// A finished reply's code blocks can be copied; while it streams the code is not whole yet.
const FINISHED_COMPONENTS: Components = {
  ...MARKDOWN_COMPONENTS,
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>
}

// The default transform drops data: URLs; image sources reach the img override raw, which decides.
const urlTransform: UrlTransform = (url, _key, node) =>
  node.tagName === 'img' ? url : defaultUrlTransform(url)

export function MessageBubble({
  message,
  aside,
  allItems,
  busy,
  loadImage,
  briefs,
  onSurfaceSend
}: {
  message: MessageItem
  // A reply to another bot or the engine, not to you: whom it answers.
  aside: Asker | null
  allItems: ChatItem[]
  busy: boolean
  loadImage: (path: string) => Promise<string>
  // The Workflows briefs in this chat by task, so a status line can name its task and step.
  briefs: Record<string, WorkflowBrief>
  onSurfaceSend: (text: string) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  if (message.kind === 'surface')
    return (
      <SurfaceCard
        id={message.id}
        surface={message.surface}
        items={allItems}
        busy={busy}
        onSend={onSurfaceSend}
      />
    )
  if (message.kind === 'notice')
    return (
      <p dir="auto" className="text-sm text-muted-foreground whitespace-pre-wrap wrap-anywhere">
        {message.text}
      </p>
    )
  if (message.kind === 'delivery')
    return (
      <QuietLine summary={<BotLine bot={message.from} label="chat.deliveryFrom" />}>
        <ReplyText text={message.text} streaming={false} briefs={briefs} />
      </QuietLine>
    )
  if (aside && message.kind === 'bot')
    return (
      <QuietLine summary={<AsideSummary to={aside} />}>
        <ReplyText text={message.text} streaming={message.streaming} briefs={briefs} />
      </QuietLine>
    )
  const brief = message.kind === 'user' && message.images.length === 0 && parseBrief(message.text)
  if (brief) return <WorkflowBriefCard brief={brief} text={message.text} />
  const stopRef = message.kind === 'user' && parseStop(message.text)
  if (stopRef)
    return (
      <QuietLine
        summary={t('chat.workflowStopSent').replace('{task}', briefs[stopRef]?.title ?? stopRef)}
      >
        <ReplyText text={message.text} streaming={false} briefs={briefs} />
      </QuietLine>
    )
  if (message.kind === 'user')
    return (
      <div className="ml-auto flex max-w-[80%] flex-col items-end gap-2">
        {message.images.map((path) => (
          <ChatImage key={path} path={path} loadImage={loadImage} />
        ))}
        {message.text && (
          <p
            dir="auto"
            className="rounded-3xl bg-secondary px-4 py-2 text-base whitespace-pre-wrap wrap-anywhere"
          >
            {message.text}
          </p>
        )}
      </div>
    )
  const reply = (
    <div className="flex max-w-[85%] min-w-0 flex-col items-start gap-1 self-start">
      <div
        dir="auto"
        className={cn(
          'chat-markdown chat-bubble max-w-full min-w-0 rounded-3xl bg-secondary px-4 py-3 text-base break-words',
          // The cursor sits after the last line of text, drawn by chat.css.
          message.streaming && 'chat-streaming'
        )}
      >
        {(message.text || message.error === null) && (
          <ReplyText text={message.text} streaming={message.streaming} briefs={briefs} />
        )}
        {message.error !== null && (
          <div className={cn(message.text && 'mt-2')}>
            <p className="text-destructive-text">{t('chat.replyFailed')}</p>
            {message.error && <FailureDetail error={message.error} />}
          </div>
        )}
      </div>
      {message.stopped && (
        <p className="px-2 text-sm text-muted-foreground">{t('chat.replyStopped')}</p>
      )}
    </div>
  )
  if (!message.sender) return reply
  // In a room several bots answer; each says who wrote it.
  return (
    <div className="flex flex-col gap-2">
      <Sender sender={message.sender} />
      {reply}
    </div>
  )
}

function useManagerHandle(): string | null {
  return useManagerName().handle
}

// A reply's markdown, with each Workflows status line shown as its row.
function ReplyText({
  text,
  streaming,
  briefs
}: {
  text: string
  streaming: boolean
  briefs: Record<string, WorkflowBrief>
}): React.JSX.Element {
  return (
    <>
      {splitReply(text).map((part, index) =>
        part.kind === 'status' ? (
          <WorkflowStatusRow key={index} status={part.status} brief={briefs[part.status.ref]} />
        ) : (
          <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm]}
            components={streaming ? MARKDOWN_COMPONENTS : FINISHED_COMPONENTS}
            urlTransform={urlTransform}
          >
            {part.text}
          </ReactMarkdown>
        )
      )}
    </>
  )
}

/**
 * Something that came into the chat besides the conversation (another bot's message, a Workflows
 * stop): one quiet line, its full text a press away.
 */
function QuietLine({
  summary,
  children
}: {
  summary: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <details className="group/quiet text-sm text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={16}
          aria-hidden="true"
          className="shrink-0 transition-transform group-open/quiet:rotate-90 motion-reduce:transition-none"
        />
        {summary}
      </summary>
      <div dir="auto" className="chat-markdown mt-2 ms-5 break-words text-foreground">
        {children}
      </div>
    </details>
  )
}

// Under "This reply did not finish": the engine's own words, as Talyx's.
function FailureDetail({ error }: { error: string }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const engineName = useManagerHandle()
  const failure = replyFailure(error, engineName)
  return (
    <p className="text-sm text-muted-foreground wrap-anywhere">
      {failure.kind === 'noProvider' ? t('chat.replyNoProvider') : failure.text}
    </p>
  )
}

function Sender({ sender }: { sender: { name: string; profile: string } }): React.JSX.Element {
  const { avatar, name } = useSenderBot(sender)
  return (
    <p className="flex items-center gap-2 text-sm font-medium">
      {avatar}
      {name}
    </p>
  )
}

function AsideSummary({ to }: { to: Asker }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  if (to === 'engine') return <span>{t('chat.backgroundNote')}</span>
  if (to === 'unseen') return <span>{t('chat.replyUnseen')}</span>
  return <BotLine bot={to} label="chat.replyTo" />
}

// A quiet line's words about another bot, with its avatar: `{name}` in the label is its name.
function BotLine({
  bot,
  label
}: {
  bot: { name: string; profile: string }
  label: TranslationKey
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const { avatar, name } = useSenderBot(bot)
  return (
    <span className="flex items-center gap-2">
      {avatar}
      {t(label).replace('{name}', name)}
    </span>
  )
}

// The roster's name and avatar for the sender; Talyx's handle in deliveries is the engine's own.
function useSenderBot(sender: { name: string; profile: string }): {
  avatar: React.JSX.Element
  name: string
} {
  const managerHandle = useManagerHandle()
  const profile = senderProfile(sender.profile, managerHandle)
  const bot = useRoster((state) => state.snapshot.bots.find((item) => item.name === profile))
  return {
    avatar: <BotAvatar bot={bot ?? unknownBot(profile)} place="row" />,
    name: bot ? botTitle(bot) : sender.name
  }
}

// Images live on the engine's disk; the gateway serves them as data URLs.
function ChatImage({
  path,
  loadImage
}: {
  path: string
  loadImage: (path: string) => Promise<string>
}): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  const load = useCallback(() => loadImage(path), [path, loadImage])
  // Without a preview the image stays a name chip.
  useLoad(load, { loaded: setSrc, failed: () => undefined })
  const name = path.split(/[\\/]/).pop() ?? path
  return src ? (
    <img src={src} alt={name} className="max-h-72 rounded-2xl" />
  ) : (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm">{name}</span>
  )
}
