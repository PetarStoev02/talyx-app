import { ArrowUp, Pencil, RefreshCw, RotateCcw, X } from 'lucide-react'
import { useLanguage } from '@shared/lib/i18n'
import type { WaitingMessage } from '@features/chat/store'
import type { TurnOutcome } from '@features/chat/turns'

// How a turn ended, and a way to ask its message again: a new answer, or a retry of one that failed.
export function OutcomeLine({
  outcome,
  name,
  onAskAgain
}: {
  outcome: TurnOutcome
  name: string
  onAskAgain: () => void
}): React.JSX.Element | null {
  const t = useLanguage((s) => s.t)
  const { kind, asked } = outcome
  const attach = asked.images.length > 0
  // A new answer to a message with images would need them attached again: that is a new message.
  if (kind === 'answered')
    return attach ? null : (
      <OutcomeButton
        label={t('chat.regenerateLabel').replace('{text}', asked.text)}
        onClick={onAskAgain}
      >
        <RefreshCw size={14} />
        {t('chat.regenerate')}
      </OutcomeButton>
    )
  const said =
    kind === 'stopped'
      ? t('chat.replyStopped')
      : kind === 'noReply'
        ? t('chat.noReply').replace('{name}', name)
        : null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-sm text-muted-foreground">
      {said && <p>{said}</p>}
      <OutcomeButton
        label={t(attach ? 'chat.retryImagesLabel' : 'chat.retryLabel').replace(
          '{text}',
          asked.text
        )}
        onClick={onAskAgain}
      >
        <RotateCcw size={14} />
        {t(attach ? 'chat.retryImages' : 'chat.retry')}
      </OutcomeButton>
    </div>
  )
}

function OutcomeButton({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-sm text-muted-foreground hover:bg-foreground/10"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

// A message held until the running answer ends, as a dashed bubble: send it now (stops that
// answer), take it back into the composer to edit, or drop it.
export function WaitingBubble({
  message,
  onSendNow,
  onEdit,
  onRemove
}: {
  message: WaitingMessage
  onSendNow: () => void
  // Null for a message with images: the composer takes text back, not files.
  onEdit: (() => void) | null
  onRemove: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const { text, images } = message.draft
  const action = 'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-foreground/10'
  return (
    <div className="ml-auto flex max-w-[80%] flex-col items-end gap-1">
      <p
        dir="auto"
        className="rounded-3xl border border-dashed border-border px-4 py-2 text-base whitespace-pre-wrap wrap-anywhere text-muted-foreground"
      >
        {text ||
          (images.length === 1
            ? t('chat.queuedImage')
            : t('chat.queuedImages').replace('{count}', String(images.length)))}
        <span className="sr-only">{` (${t('chat.queued')})`}</span>
      </p>
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <button
          type="button"
          aria-label={`${t('chat.sendNow')}: ${text}`}
          className={action}
          onClick={onSendNow}
        >
          <ArrowUp size={14} />
          {t('chat.sendNow')}
        </button>
        {onEdit && (
          <button
            type="button"
            aria-label={`${t('chat.editQueued')}: ${text}`}
            className={action}
            onClick={onEdit}
          >
            <Pencil size={14} />
          </button>
        )}
        <button
          type="button"
          aria-label={`${t('chat.unqueue')}: ${text}`}
          className={action}
          onClick={onRemove}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
