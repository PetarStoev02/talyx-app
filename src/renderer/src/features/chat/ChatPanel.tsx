import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { cn } from '@shared/lib/utils'
import { CloseButton } from '@shared/ui/CloseButton'
import type { Bot, ChatMessage, ConversationTarget } from '../../../../shared/office'
import { ChatComposer, type ComposerExtra } from './ChatComposer'
import { useConversation } from './useConversation'

const GROUP_BANNER = 'Mirror of the Grok chat — messages a bot did not report are missing.'

type ChatBot = Pick<Bot, 'id' | 'name' | 'color'>

interface ChatPanelProps {
  target: ConversationTarget
  header: React.ReactNode
  /** Bots that may appear as authors. */
  bots: ChatBot[]
  composerExtra: ComposerExtra | null
}

export function ChatPanel({
  target,
  header,
  bots,
  composerExtra
}: ChatPanelProps): React.JSX.Element {
  const { messages, send } = useConversation(target)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  async function trySend(text: string): Promise<boolean> {
    try {
      await send(text)
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the message')
      return false
    }
  }

  return (
    <section
      aria-label="Chat"
      className="absolute top-[72px] right-0 bottom-0 z-20 flex w-[360px] flex-col border-l border-[#2e2e2e] bg-[#111]"
    >
      <div className="border-b border-[#2e2e2e] p-4">{header}</div>
      {target.kind === 'group' && (
        <p className="border-b border-[#2e2e2e] px-4 py-2 text-[11px] text-[#949494]">
          {GROUP_BANNER}
        </p>
      )}
      <div ref={listRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-xs text-[#949494]">No messages yet.</p>}
        {messages.map((m) => (
          <Message
            key={m.key}
            message={m}
            bot={bots.find((b) => b.id === m.author) ?? null}
            onRetry={trySend}
          />
        ))}
      </div>
      <ChatComposer onSend={trySend} extra={composerExtra} />
    </section>
  )
}

function Message({
  message,
  bot,
  onRetry
}: {
  message: ChatMessage
  bot: ChatBot | null
  onRetry: (text: string) => Promise<boolean>
}): React.JSX.Element {
  const owner = message.author === 'owner'
  const name = owner ? 'You' : (bot?.name ?? message.author)

  if (message.kind !== 'text') {
    return (
      <p className="text-[11px] text-[#949494]">
        {name} · {message.kind}: {message.text}
      </p>
    )
  }

  return (
    <div className={cn('flex max-w-[85%] flex-col', owner ? 'items-end self-end' : 'items-start')}>
      {!owner && (
        <span className="mb-0.5 flex items-center gap-1.5 text-[11px] text-[#949494]">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ background: bot?.color ?? '#949494' }}
          />
          {name}
        </span>
      )}
      <div
        className={cn(
          'rounded-lg px-2.5 py-1.5 text-[13px] break-words whitespace-pre-wrap',
          owner ? 'bg-white text-black' : 'border border-[#2e2e2e] bg-black text-white'
        )}
      >
        {message.text}
      </div>
      {message.status === 'failed' && (
        <span className="mt-0.5 text-[11px] text-[#949494]">
          failed ·{' '}
          <button
            type="button"
            onClick={() => void onRetry(message.text)}
            className="cursor-pointer text-white underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-white"
          >
            Retry
          </button>
        </span>
      )}
      {message.status === 'no-reply' && (
        <span className="mt-0.5 text-[11px] text-[#949494]">no reply yet</span>
      )}
    </div>
  )
}

/** Header of a group chat: name and member avatars. */
export function GroupChatHeader({
  name,
  members,
  onClose
}: {
  name: string
  members: ChatBot[]
  onClose: () => void
}): React.JSX.Element {
  return (
    <div>
      <div className="flex items-start justify-between">
        <h3 className="font-semibold">{name}</h3>
        <CloseButton onClose={onClose} />
      </div>
      <ul aria-label="Members" className="mt-2 flex flex-wrap gap-1.5">
        {members.map((m) => (
          <li
            key={m.id}
            title={m.name}
            className="flex size-6 items-center justify-center rounded-full text-[11px] font-semibold text-black"
            style={{ background: m.color }}
          >
            {m.name.charAt(0).toUpperCase()}
          </li>
        ))}
      </ul>
    </div>
  )
}
