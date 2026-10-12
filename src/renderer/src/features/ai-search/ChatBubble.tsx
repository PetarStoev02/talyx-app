import { User, Sparkles } from 'lucide-react'
import type { ChatMessage } from '@app/providers/useSearch'
import { useLanguage } from '@app/providers/useLanguage'

export function ChatBubble({ message }: { message: ChatMessage }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const isUser = message.role === 'user'

  return (
    <div className="flex items-start gap-3">
      <div
        className={
          'flex size-7 shrink-0 items-center justify-center rounded-full ' +
          (isUser ? 'bg-muted' : 'bg-primary/10')
        }
      >
        {isUser ? (
          <User className="size-3.5 text-muted-foreground" />
        ) : (
          <Sparkles className="size-3.5 text-primary" />
        )}
      </div>
      <div className="mt-0.5 min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">
          {isUser ? t('search.you') : t('search.talyxAi')}
        </p>
        <p className="mt-0.5 text-sm text-foreground">{message.content}</p>
      </div>
    </div>
  )
}
