import { useState } from 'react'
import { toast } from 'sonner'
import type { OfficeGiveTaskInput, OfficeSnapshot } from '../../../../shared/office'
import { cardButton, primaryButton, errorMessage } from './cardStyles'

const MAX_TASK = 500
const WEBHOOK = 'webhook'
const SHORT_ID = 8

interface GiveTaskFormProps {
  bot: OfficeSnapshot['bots'][number]
  t3Projects: OfficeSnapshot['t3Projects']
  onClose: () => void
}

export function GiveTaskForm({ bot, t3Projects, onClose }: GiveTaskFormProps): React.JSX.Element {
  const targets = [
    ...(bot.webhookReady ? [{ value: WEBHOOK, label: 'Grok routine' }] : []),
    // A short id stands in when T3's project names cannot be read.
    ...bot.t3ProjectIds.map((id) => ({
      value: id,
      label: `T3: ${t3Projects.find((p) => p.id === id)?.name ?? id.slice(0, SHORT_ID)}`
    }))
  ]
  const [task, setTask] = useState('')
  const [target, setTarget] = useState(targets[0]?.value ?? '')
  const [sending, setSending] = useState(false)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSending(true)
    const input: OfficeGiveTaskInput = {
      botId: bot.id,
      task: task.trim(),
      target: target === WEBHOOK ? { kind: 'webhook' } : { kind: 't3', t3ProjectId: target }
    }
    try {
      await window.api.officeGiveTask(input)
      onClose()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not give the task'))
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2" aria-label="Give task">
      <textarea
        autoFocus
        aria-label="Task"
        value={task}
        maxLength={MAX_TASK}
        rows={3}
        onChange={(e) => setTask(e.target.value)}
        className="resize-none rounded-md border border-[#444] bg-black p-2 text-[13px] outline-none focus:border-white"
      />
      <div className="text-right text-[11px] text-[#949494] tabular-nums">
        {task.length}/{MAX_TASK}
      </div>
      {targets.length > 0 ? (
        <select
          aria-label="Send to"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="h-[30px] rounded-md border border-[#444] bg-black px-2 text-[13px]"
        >
          {targets.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-xs text-[#949494]">No webhook key or T3 project set for this bot.</p>
      )}
      <div>
        <button
          type="submit"
          disabled={sending || !task.trim() || !target}
          className={primaryButton}
        >
          {sending ? 'Sending…' : 'Give task'}
        </button>
        <button type="button" onClick={onClose} className={cardButton}>
          Cancel
        </button>
      </div>
    </form>
  )
}
