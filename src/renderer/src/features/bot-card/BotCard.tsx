import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { OfficeSnapshot } from '../../../../shared/office'
import { GiveTaskForm } from './GiveTaskForm'
import { cardButton, errorMessage, primaryButton } from './cardStyles'

type SnapshotBot = OfficeSnapshot['bots'][number]

interface BotCardProps {
  bot: SnapshotBot
  roomName: string
  t3Projects: OfficeSnapshot['t3Projects']
  onClose: () => void
}

type Form = 'none' | 'task' | 'thread'

export function BotCard({ bot, roomName, t3Projects, onClose }: BotCardProps): React.JSX.Element {
  const [form, setForm] = useState<Form>('none')
  const { placement } = bot

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function openExternal(url: string): void {
    window.api
      .officeOpenExternal(url)
      .catch((err: unknown) => toast.error(errorMessage(err, 'Could not open the link')))
  }

  return (
    <section
      aria-label={`${bot.name} card`}
      className="absolute right-[280px] bottom-4 z-20 w-[290px] rounded-lg border border-[#2e2e2e] bg-[#111] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.5)]"
    >
      <h3 className="font-semibold">{bot.name}</h3>
      <div className="mt-0.5 text-xs text-[#949494]">
        {roomName} · {placement.task ?? 'Idle'}
      </div>
      {placement.waiting && <div className="mt-1 text-xs text-white">Waiting for you in T3</div>}
      {form === 'task' && (
        <GiveTaskForm bot={bot} t3Projects={t3Projects} onClose={() => setForm('none')} />
      )}
      {form === 'thread' && placement.t3ThreadId && (
        <SendToThreadForm threadId={placement.t3ThreadId} onClose={() => setForm('none')} />
      )}
      {form === 'none' && (
        <div>
          <button type="button" className={primaryButton} onClick={() => setForm('task')}>
            Give task
          </button>
          {placement.t3ThreadId && (
            <button type="button" className={cardButton} onClick={() => setForm('thread')}>
              Send to thread
            </button>
          )}
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
              Open chat
            </button>
          )}
        </div>
      )}
    </section>
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
