import { useEffect, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@shared/ui/button'
import { useLanguage } from '@app/providers/useLanguage'
import type { TranslationKey } from '@shared/lib/i18n'
import { conversationApi, type Conversation } from '@shared/api/conversation'
import { useAgent, type TranscriptEntry } from './useAgent'
import { toTranscript } from './toTranscript'

/** Relative time in the owner's language, without pulling in a date library. */
function ago(seconds: number, t: (key: TranslationKey) => string): string {
  const minutes = Math.floor((Date.now() / 1000 - seconds) / 60)
  if (minutes < 1) return t('conversations.justNow')
  if (minutes < 60) return t('conversations.minutesAgo').replace('{count}', String(minutes))
  if (minutes < 60 * 24) {
    return t('conversations.hoursAgo').replace('{count}', String(Math.floor(minutes / 60)))
  }
  return t('conversations.daysAgo').replace('{count}', String(Math.floor(minutes / (60 * 24))))
}

export function ConversationsPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const load = useAgent((s) => s.load)
  const [items, setItems] = useState<Conversation[]>([])

  useEffect(() => {
    conversationApi
      .list()
      .then(setItems)
      .catch(() => toast.error(t('conversations.loadFailed')))
  }, [t])

  async function open(id: string): Promise<void> {
    try {
      const stored = await conversationApi.open(id)
      load(stored.map(toTranscript).filter((e): e is TranscriptEntry => e !== null))
      onClose()
    } catch {
      toast.error(t('conversations.loadFailed'))
    }
  }

  async function remove(id: string): Promise<void> {
    await conversationApi.remove(id)
    setItems(await conversationApi.list())
  }

  return (
    <div className="absolute inset-y-0 right-0 z-20 flex w-80 flex-col border-l border-border bg-card shadow-xl">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-sm font-medium text-foreground">{t('conversations.title')}</span>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('common.close')}>
          <X className="size-4" />
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          {t('conversations.empty')}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-auto p-2">
          {items.map((item) => (
            <li key={item.id} className="group flex items-center gap-1">
              <button
                onClick={() => void open(item.id)}
                className="min-w-0 flex-1 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
              >
                <span className="block truncate text-[13px] text-foreground">{item.title}</span>
                <span className="text-[11px] text-muted-foreground">{ago(item.updatedAt, t)}</span>
              </button>
              <button
                onClick={() => void remove(item.id)}
                aria-label={t('conversations.delete')}
                className="shrink-0 rounded-md p-2 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="shrink-0 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        {t('conversations.retention')}
      </p>
    </div>
  )
}
