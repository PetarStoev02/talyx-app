import { useMemo } from 'react'
import { ArrowDown } from 'lucide-react'
import { useStickToEnd } from '@shared/hooks/useStickToEnd'
import { useLanguage } from '@shared/lib/i18n'
import type { ChatItem, MessageItem } from '@features/chat/types'
import { surfaceListKey } from '@features/chat/surfaceKeys'
import { briefsByRef, isQuietReply } from '@features/chat/workflowLines'
import { MessageBubble } from './MessageBubble'

/** Newest at the bottom; it follows new text while you are at the end, and offers a way back. */
export function Transcript({
  items,
  allItems,
  children,
  loadImage,
  onSurfaceSend
}: {
  items: MessageItem[]
  allItems: ChatItem[]
  children?: React.ReactNode
  loadImage: (path: string) => Promise<string>
  onSurfaceSend: (text: string) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const briefs = useMemo(
    () => briefsByRef(items.flatMap((item) => (item.kind === 'user' ? [item.text] : []))),
    [items]
  )

  const shown = useMemo(() => [items, children], [items, children])
  const { scroller, atEnd, onScroll, toEnd } = useStickToEnd<HTMLDivElement>(shown)

  return (
    <div className="relative min-h-0 flex-1">
      {/* The edges fade while there is more to scroll, so a line under the name pill or above the
          composer does not end in a hard cut. */}
      <div ref={scroller} onScroll={onScroll} className="scroll-y-stable scroll-fade h-full">
        <ol className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6">
          {items
            .filter((item) => !isQuietReply(item))
            .map((item, index) => (
              <li
                key={
                  item.kind === 'surface'
                    ? surfaceListKey(allItems, item)
                    : item.id || String(index)
                }
                data-message-id={item.id}
                className="flex flex-col"
              >
                <MessageBubble
                  message={item}
                  allItems={allItems}
                  loadImage={loadImage}
                  briefs={briefs}
                  onSurfaceSend={onSurfaceSend}
                />
              </li>
            ))}
          {children}
        </ol>
      </div>
      {!atEnd && (
        <button
          type="button"
          aria-label={t('chat.scrollToBottom')}
          onClick={toEnd}
          className="absolute bottom-4 left-1/2 inline-flex size-9 -translate-x-1/2 items-center justify-center rounded-full bg-secondary shadow-md hover:bg-foreground/10"
        >
          <ArrowDown size={18} />
        </button>
      )}
    </div>
  )
}
