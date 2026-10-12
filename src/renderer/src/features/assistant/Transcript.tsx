import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { ThinkingOrb } from 'thinking-orbs'
import { cn } from '@shared/lib/utils'
import type { TranslationKey } from '@shared/lib/i18n'
import type { ActivityStatus } from '@shared/api/agent'
import { useLanguage } from '@app/providers/useLanguage'
import type { TranscriptEntry } from './useAgent'
import { visibleEntries } from './transcriptView'
import { orbStateFor, statusLabelKey } from './orbState'
import { orbTheme } from './orbTheme'
import { AssistantMarkdown } from './AssistantMarkdown'
import { ResultCard } from './ResultCard'

/** Error keys with a translated line; anything else shows the message as sent. */
const ERROR_TEXT: Record<string, TranslationKey> = {
  agent_missing_api_key: 'assistant.error.missingApiKey',
  agent_aborted: 'assistant.error.aborted',
  agent_reply_truncated: 'assistant.error.truncated',
  agent_iteration_limit: 'assistant.error.iterationLimit',
  agent_secure_storage_unavailable: 'assistant.error.secureStorage',
  agent_claude_code_missing: 'assistant.error.claudeCodeMissing',
  agent_claude_code_signed_out: 'assistant.error.claudeCodeSignedOut',
  agent_failed: 'assistant.error.failed'
}

export function Transcript({
  entries,
  status,
  limit,
  voiceMode = false,
  speaking = false
}: {
  entries: TranscriptEntry[]
  /** What the brain is doing right now; renders the live row under the entries. */
  status: ActivityStatus | null
  limit?: number
  /** Voice mode answers out loud, so the spoken reply is not repeated on screen. */
  voiceMode?: boolean
  /** True while audio is playing; the orb shows it. */
  speaking?: boolean
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const visible = visibleEntries(entries, voiceMode)
  const shown = limit ? visible.slice(-limit) : visible
  const end = useRef<HTMLDivElement>(null)
  // Follow the conversation: every new turn, tool answer or step change lands in view.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [entries.length, status?.state, status?.label, speaking])
  return (
    <div>
      <ul className="space-y-4">
        {shown.map((e, i) => {
          if (e.kind === 'user')
            return (
              <li
                key={i}
                className="ml-auto w-fit max-w-[85%] rounded-2xl bg-accent px-4 py-2 text-sm text-foreground"
              >
                {e.text}
              </li>
            )
          if (e.kind === 'assistant')
            return e.interim ? (
              <li key={i} className="text-xs text-muted-foreground">
                {e.text}
              </li>
            ) : (
              <li key={i} className="text-sm text-foreground/90">
                <AssistantMarkdown text={e.text} />
              </li>
            )
          if (e.kind === 'card')
            return (
              <li key={i}>
                <ResultCard card={e.card} />
              </li>
            )
          if (e.kind === 'action')
            return (
              <li
                key={i}
                className={cn(
                  'flex items-center gap-2 font-mono text-xs',
                  e.ok ? 'text-muted-foreground' : 'text-destructive'
                )}
              >
                {e.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                <span className="break-all">
                  {e.label}
                  {e.error ? ` — ${e.error}` : ''}
                </span>
              </li>
            )
          const known = ERROR_TEXT[e.key]
          return (
            <li key={i} className="text-sm text-destructive">
              {known ? t(known) : e.message}
            </li>
          )
        })}
      </ul>
      {status && <LiveStatus status={status} speaking={speaking} />}
      <div ref={end} />
    </div>
  )
}

/** "Working for 4s" plus the current step, the way a coding agent shows its turn. */
function LiveStatus({
  status,
  speaking
}: {
  status: ActivityStatus
  speaking: boolean
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(startedAt)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const labelKey = statusLabelKey(status)
  return (
    <div className="mt-4 border-t border-border/60 pt-3" aria-live="polite">
      <p className="text-sm text-muted-foreground">
        {t('assistant.status.workingFor')} {Math.floor((now - startedAt) / 1000)}s
      </p>
      <p className="mt-2 flex items-center gap-3 text-sm text-foreground/80">
        {/* The 64px canvas carries the per-state choreography; the 20px one is too coarse to tell apart. */}
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden">
          <ThinkingOrb
            state={orbStateFor(status, speaking)}
            size={64}
            theme={orbTheme()}
            style={{ transform: 'scale(0.56)' }}
          />
        </span>
        {labelKey ? t(labelKey) : status.label}
      </p>
    </div>
  )
}
