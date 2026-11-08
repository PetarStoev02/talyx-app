import { useEffect, useState } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import type { Components, UrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useEngine } from '@app/providers/useEngine'
import { useLanguage } from '@app/providers/useLanguage'
import { BotAvatar } from '@features/bots/BotAvatar'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import { markdownImage } from '@features/chat/markdownImage'
import { senderProfile } from '@features/chat/transcript'
import type { MessageItem } from '@features/chat/types'
import { cn } from '@shared/lib/utils'
import { CopyReplyButton } from './CopyReplyButton'

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

// The default transform drops data: URLs; image sources reach the img override raw, which decides.
const urlTransform: UrlTransform = (url, _key, node) =>
  node.tagName === 'img' ? url : defaultUrlTransform(url)

export function MessageBubble({
  message,
  loadImage
}: {
  message: MessageItem
  loadImage: (path: string) => Promise<string>
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  if (message.kind === 'notice')
    return (
      <p dir="auto" className="text-sm text-muted-foreground whitespace-pre-wrap wrap-anywhere">
        {message.text}
      </p>
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
  const copyable = !message.streaming && message.text.trim() !== ''
  const reply = (
    <div className="group flex max-w-[85%] min-w-0 flex-col items-start gap-1 self-start">
      <div
        dir="auto"
        className={cn(
          'chat-markdown chat-bubble relative max-w-full min-w-0 rounded-3xl bg-secondary px-4 py-3 text-base break-words',
          // The cursor sits after the last line of text, drawn by chat.css.
          message.streaming && 'chat-streaming'
        )}
      >
        {(message.text || message.error === null) && (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={MARKDOWN_COMPONENTS}
            urlTransform={urlTransform}
          >
            {message.text}
          </ReactMarkdown>
        )}
        {message.error !== null && (
          <div className={cn(message.text && 'mt-2')}>
            <p className="text-destructive-text">{t('chat.replyFailed')}</p>
            {message.error && (
              <p className="text-sm text-muted-foreground wrap-anywhere">{message.error}</p>
            )}
          </div>
        )}
        {copyable && <CopyReplyButton text={message.text} />}
      </div>
      {message.stopped && (
        <p className="px-2 text-sm text-muted-foreground">{t('chat.replyStopped')}</p>
      )}
    </div>
  )
  if (!message.sender) return reply
  // In a room several bots answer, and other bots deliver into a chat; each says who wrote it.
  return (
    <div className="flex flex-col gap-2">
      <Sender sender={message.sender} />
      {reply}
    </div>
  )
}

// The roster's name and avatar for the sender; Talyx's handle in deliveries is the engine's own.
function Sender({ sender }: { sender: { name: string; profile: string } }): React.JSX.Element {
  const managerHandle = useEngine((s) =>
    s.status?.state === 'attached' ? s.status.managerHandle : null
  )
  const profile = senderProfile(sender.profile, managerHandle)
  const bot = useRoster((state) => state.snapshot.bots.find((item) => item.name === profile))
  return (
    <p className="flex items-center gap-2 text-sm font-medium">
      <BotAvatar bot={bot ?? { name: profile, meta: {} }} place="row" />
      {bot ? botTitle(bot) : sender.name}
    </p>
  )
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
  useEffect(() => {
    let live = true
    loadImage(path)
      .then((url) => live && setSrc(url))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [path, loadImage])
  const name = path.split(/[\\/]/).pop() ?? path
  return src ? (
    <img src={src} alt={name} className="max-h-72 rounded-2xl" />
  ) : (
    <span className="rounded-full bg-secondary px-3 py-1 text-sm">{name}</span>
  )
}
