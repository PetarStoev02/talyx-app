import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
  return (
    <div className="chat-markdown text-base">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {message.text}
      </ReactMarkdown>
      {message.streaming && <span aria-hidden="true" className="chat-cursor" />}
      {message.error && <p className="mt-2 text-base text-destructive">{message.error}</p>}
    </div>
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
