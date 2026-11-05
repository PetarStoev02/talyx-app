import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import type { ChatItem } from '@features/chat/types'
import { MessageBubble } from './MessageBubble'
import { ToolLine } from './ToolLine'

// How close to the end still counts as reading the newest message.
const STICK_DISTANCE_PX = 48

/** Newest at the bottom; it follows new text while you are at the end, and offers a way back. */
export function Transcript({
  items,
  children,
  loadImage
}: {
  items: ChatItem[]
  children?: React.ReactNode
  loadImage: (path: string) => Promise<string>
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const scroller = useRef<HTMLDivElement>(null)
  const [atEnd, setAtEnd] = useState(true)

  useLayoutEffect(() => {
    const element = scroller.current
    if (element && atEnd) element.scrollTop = element.scrollHeight
  }, [items, children, atEnd])

  function onScroll(): void {
    const element = scroller.current
    if (!element) return
    setAtEnd(element.scrollHeight - element.scrollTop - element.clientHeight < STICK_DISTANCE_PX)
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} onScroll={onScroll} className="scroll-y-stable h-full">
        <ol className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6">
          {items.map((item, index) => (
            <li key={item.id || index} className="flex flex-col">
              {item.kind === 'tool' ? (
                <ToolLine tool={item} />
              ) : (
                <MessageBubble message={item} loadImage={loadImage} />
              )}
            </li>
          ))}
          {children}
        </ol>
      </div>
      {!atEnd && (
        <button
          type="button"
          aria-label={t('chat.scrollToBottom')}
          onClick={() => setAtEnd(true)}
          className="absolute bottom-4 left-1/2 inline-flex size-9 -translate-x-1/2 items-center justify-center rounded-full bg-secondary shadow-md hover:bg-foreground/10"
        >
          <ArrowDown size={18} />
        </button>
      )}
    </div>
  )
}
