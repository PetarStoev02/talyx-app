import { useEffect, useState } from 'react'
import { Check, ChevronRight, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import { summarizeStatus } from '@features/chat/workflowLines'
import type { FixedStep, WorkflowBrief, WorkflowStatus } from '@features/chat/workflowLines'
import type { TranslationKey } from '@shared/lib/i18n'
import { cn } from '@shared/lib/utils'

const COPIED_MS = 1500

const STEP_KEYS: Record<FixedStep, TranslationKey> = {
  ready: 'chat.workflowStep.ready',
  'needs-you': 'chat.workflowStep.needs-you',
  merged: 'chat.workflowStep.merged',
  done: 'chat.workflowStep.done',
  stopped: 'chat.workflowStep.stopped'
}

// The tones a step's dot takes: done and merged finished well, needs-you waits on you.
const STEP_TONES: Partial<Record<FixedStep, string>> = {
  done: 'bg-success',
  merged: 'bg-success',
  ready: 'bg-success',
  'needs-you': 'bg-warning'
}

/**
 * A Workflows brief, sent to Talyx by the module, as a compact card in place of its long text: the
 * task and its workflow, with the full brief a press away and a copy of it.
 */
export function WorkflowBriefCard({
  brief,
  text
}: {
  brief: WorkflowBrief
  text: string
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [open, setOpen] = useState(false)
  const copy = useCopy(text, 'chat.workflowCopyFailed')
  return (
    <div className="ml-auto flex w-full max-w-[80%] flex-col gap-2 rounded-3xl bg-secondary px-4 py-3">
      <p className="text-sm text-muted-foreground">
        {t('chat.workflowTask')}
        {brief.workflow && ` · ${brief.workflow}`}
      </p>
      <p dir="auto" className="text-base font-medium wrap-anywhere">
        {brief.title}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronRight
            size={16}
            aria-hidden="true"
            className={cn(
              'transition-transform motion-reduce:transition-none',
              open && 'rotate-90'
            )}
          />
          {t(open ? 'chat.workflowHideBrief' : 'chat.workflowShowBrief')}
        </button>
        <button
          type="button"
          aria-label={t('chat.workflowCopyBrief')}
          onClick={copy.copy}
          className="ms-auto inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
        >
          {copy.copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
        <span className="sr-only" role="status">
          {copy.copied && t('chat.workflowBriefCopied')}
        </span>
      </div>
      {open && (
        <p dir="auto" className="text-sm whitespace-pre-wrap wrap-anywhere">
          {text}
        </p>
      )}
    </div>
  )
}

/**
 * A status line a bot posted for a Workflows task, as one small row: the task, its step and round,
 * and what it came to or why it waits. The line as written shows on request, to read or copy.
 */
export function WorkflowStatusRow({
  status,
  brief
}: {
  status: WorkflowStatus
  brief: WorkflowBrief | undefined
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const summary = summarizeStatus(status, brief)
  const fixed = 'fixed' in summary.step ? summary.step.fixed : null
  const step = fixed ? t(STEP_KEYS[fixed]) : 'name' in summary.step ? summary.step.name : ''
  return (
    <details className="group/status my-1 rounded-2xl bg-background/60 px-3 py-2 text-sm">
      <summary
        title={t('chat.workflowShowLine')}
        className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden"
      >
        <span
          aria-hidden="true"
          className={cn('size-2 shrink-0 rounded-full', (fixed && STEP_TONES[fixed]) || 'bg-info')}
        />
        <span className="min-w-0 truncate font-medium">{summary.task}</span>
        <span className="shrink-0 text-muted-foreground">
          {step}
          {summary.round &&
            ` · ${t('chat.workflowRound').replace('{round}', String(summary.round))}`}
        </span>
      </summary>
      {summary.detail && (
        <p dir="auto" className="mt-1 wrap-anywhere">
          {summary.detail}
        </p>
      )}
      <code className="mt-1 hidden text-xs wrap-anywhere text-muted-foreground group-open/status:block">
        {status.line}
      </code>
    </details>
  )
}

/** Copies `text`, saying so for a moment; a refused copy says how to do it by hand. */
function useCopy(text: string, failed: TranslationKey): { copy: () => void; copied: boolean } {
  const t = useLanguage((s) => s.t)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])
  const copy = (): void => {
    navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => toast.error(t(failed))
    )
  }
  return { copy, copied }
}
