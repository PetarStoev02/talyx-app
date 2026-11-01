import { useState } from 'react'
import { toast } from 'sonner'
import { timeAgo } from '@shared/lib/utils'
import { useMinuteClock } from '@shared/lib/useMinuteClock'
import { CloseButton } from '@shared/ui/CloseButton'
import type { OfficeSnapshot } from '../../../../shared/office'
import { cardButton, errorMessage, primaryButton } from './cardStyles'

type SnapshotBot = OfficeSnapshot['bots'][number]

interface BotCardProps {
  bot: SnapshotBot
  roomName: string
  groupNames: string[]
  onClose: () => void
}

/** The bot's details: the header of its chat. */
export function BotCard({ bot, roomName, groupNames, onClose }: BotCardProps): React.JSX.Element {
  const now = useMinuteClock()
  const [threadOpen, setThreadOpen] = useState(false)
  const { placement } = bot

  function openExternal(url: string): void {
    window.api
      .officeOpenExternal(url)
      .catch((err: unknown) => toast.error(errorMessage(err, 'Could not open the link')))
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: bot.color }} />
          {bot.name}
        </h3>
        <CloseButton onClose={onClose} />
      </div>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-[#949494]">Groups</dt>
        <dd>{groupNames.join(', ') || 'None'}</dd>
        <dt className="text-[#949494]">Now</dt>
        <dd>
          {roomName} · {placement.task ?? 'Idle'}
        </dd>
        <dt className="text-[#949494]">Webhook</dt>
        <dd>{bot.webhookReady ? 'ready' : 'not set'}</dd>
        <dt className="text-[#949494]">Last heard</dt>
        <dd>{placement.lastSeenAt ? timeAgo(placement.lastSeenAt, now) : 'never'}</dd>
      </dl>
      {placement.waiting && <div className="mt-1 text-xs text-white">Waiting for you in T3</div>}
      {threadOpen && placement.t3ThreadId ? (
        <SendToThreadForm threadId={placement.t3ThreadId} onClose={() => setThreadOpen(false)} />
      ) : (
        <div>
          {placement.t3Link && (
            <button
              type="button"
              className={cardButton}
              onClick={() => openExternal(placement.t3Link!)}
            >
              Open in T3
            </button>
          )}
          {bot.grokLink && (
            <button
              type="button"
              className={cardButton}
              onClick={() => openExternal(bot.grokLink!)}
            >
              Open in Grok
            </button>
          )}
          {placement.t3ThreadId && (
            <button type="button" className={cardButton} onClick={() => setThreadOpen(true)}>
              Send to thread
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function SendToThreadForm({
  threadId,
  onClose
}: {
  threadId: string
  onClose: () => void
}): React.JSX.Element {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSending(true)
    try {
      await window.api.officeSendToThread({ threadId, message: message.trim() })
      onClose()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not send to the thread'))
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col" aria-label="Send to thread">
      <textarea
        autoFocus
        aria-label="Message"
        value={message}
        rows={3}
        onChange={(e) => setMessage(e.target.value)}
        className="resize-none rounded-md border border-[#444] bg-black p-2 text-[13px] outline-none focus:border-white"
      />
      <div>
        <button type="submit" disabled={sending || !message.trim()} className={primaryButton}>
          {sending ? 'Sending…' : 'Send'}
        </button>
        <button type="button" onClick={onClose} className={cardButton}>
          Cancel
        </button>
      </div>
    </form>
  )
}
