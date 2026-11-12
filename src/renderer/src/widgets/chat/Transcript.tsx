import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import type { MessageItem } from '@features/chat/types'
import { briefsByRef, isProgressReport } from '@features/chat/workflowLines'
import { MessageBubble } from './MessageBubble'

// How close to the end still counts as reading the newest message.
const STICK_DISTANCE_PX = 48

/** A bot's report that a Workflows task moved a step stays out of the chat: Workflows shows it. */
function isShown(item: MessageItem): boolean {
  return !(item.kind === 'bot' && !item.streaming && isProgressReport(item.text))
}

/** Newest at the bottom; it follows new text while you are at the end, and offers a way back. */
export function Transcript({
  items,
  children,
  loadImage
}: {
  items: MessageItem[]
  children?: React.ReactNode
  loadImage: (path: string) => Promise<string>
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const scroller = useRef<HTMLDivElement>(null)
  const [atEnd, setAtEnd] = useState(true)
  const briefs = useMemo(
    () => briefsByRef(items.flatMap((item) => (item.kind === 'user' ? [item.text] : []))),
    [items]
  )

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
      {/* The edges fade while there is more to scroll, so a line under the name pill or above the
          composer does not end in a hard cut. */}
      <div ref={scroller} onScroll={onScroll} className="scroll-y-stable scroll-fade h-full">
        <ol className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6">
          {items.filter(isShown).map((item, index) => (
            <li key={item.id || index} className="flex flex-col">
              <MessageBubble message={item} loadImage={loadImage} briefs={briefs} />
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
