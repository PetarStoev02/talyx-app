import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useEngine } from '@app/providers/useEngine'
import { BotAvatar } from '@features/bots/BotAvatar'
import { botTitle } from '@features/bots/roster'
import { useRoster } from '@features/bots/store'
import type { ChatItem } from '@features/chat/types'

// Links open in the browser through the window-open guard, never inside the app.
const MARKDOWN_COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

type Message = Extract<ChatItem, { kind: 'user' | 'bot' | 'notice' }>

export function MessageBubble({
  message,
  loadImage
}: {
  message: Message
  loadImage: (path: string) => Promise<string>
}): React.JSX.Element {
  if (message.kind === 'notice')
    return <p className="text-sm text-muted-foreground whitespace-pre-wrap">{message.text}</p>
  if (message.kind === 'user')
    return (
      <div className="ml-auto flex max-w-[80%] flex-col items-end gap-2">
        {message.images.map((path) => (
          <ChatImage key={path} path={path} loadImage={loadImage} />
        ))}
        {message.text && (
          <p className="rounded-3xl bg-secondary px-4 py-2 text-base whitespace-pre-wrap">
            {message.text}
          </p>
        )}
      </div>
    )
  const reply = (
    <div className="chat-markdown chat-bubble max-w-[85%] self-start rounded-3xl bg-secondary px-4 py-3 text-base">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {message.text}
      </ReactMarkdown>
      {message.streaming && <span aria-hidden="true" className="chat-cursor" />}
      {message.error && <p className="mt-2 text-base text-destructive">{message.error}</p>}
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
  const profile = sender.profile === managerHandle ? 'default' : sender.profile
  const bot = useRoster((state) => state.snapshot.bots.find((item) => item.name === profile))
  return (
    <p className="flex items-center gap-2 text-sm font-medium">
      <BotAvatar bot={bot ?? { name: profile, meta: {} }} />
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
