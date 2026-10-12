import { useEffect } from 'react'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { useLanguage } from '@app/providers/useLanguage'
import type { AgentDecision, ApprovalRequest } from '@shared/api/agent'
import { decisionForKey } from './approvalKeys'

export function ApprovalCard({
  request,
  onDecision
}: {
  request: ApprovalRequest
  onDecision: (decision: AgentDecision) => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)

  useEffect(() => {
    const shownAt = performance.now()
    function onKey(e: KeyboardEvent): void {
      const decision = decisionForKey(e, performance.now() - shownAt)
      if (decision === null) return
      e.preventDefault()
      onDecision(decision)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDecision])

  return (
    <div className="rounded-xl border border-border bg-card/80 backdrop-blur">
      {request.text && <p className="px-4 pt-3 text-sm text-foreground">{request.text}</p>}
      {request.proposals.map((p) => (
        <div key={p.id} className="border-t border-border/60 px-4 py-3">
          <p className="text-[13px] font-medium text-foreground">{p.summary}</p>
          {p.operations.length > 0 && (
            <p className="mt-1.5 font-mono text-xs text-foreground break-all">
              {p.operations[0].label}
            </p>
          )}
          {p.operations.length > 1 && (
            <details className="mt-1.5 group">
              <summary className="cursor-pointer list-none text-xs text-muted-foreground hover:text-foreground">
                <ChevronRight className="mr-1 inline size-3 transition-transform group-open:rotate-90" />
                {t('assistant.moreSteps').replace('{count}', String(p.operations.length - 1))}
              </summary>
              <ul className="mt-1.5 space-y-1 pl-4">
                {p.operations.slice(1).map((op, i) => (
                  <li key={i} className="font-mono text-xs text-muted-foreground break-all">
                    {op.label}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {!p.reversible && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="size-3.5" /> {t('assistant.irreversible')}
            </p>
          )}
        </div>
      ))}
      <div className="flex items-center justify-end gap-2 border-t border-border/60 px-4 py-2.5">
        <Button variant="ghost" size="sm" onClick={() => onDecision('deny')}>
          {t('assistant.deny')} <kbd className="ml-1 text-[10px] opacity-60">Esc</kbd>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDecision('rest')}>
          {t('assistant.approveRest')} <kbd className="ml-1 text-[10px] opacity-60">⌥A</kbd>
        </Button>
        <Button size="sm" onClick={() => onDecision('approve')}>
          {t('assistant.approve')} <kbd className="ml-1 text-[10px] opacity-60">↵</kbd>
        </Button>
      </div>
    </div>
  )
}
