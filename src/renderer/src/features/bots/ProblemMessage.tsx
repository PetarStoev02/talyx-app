import { CircleAlert } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import type { RosterProblem } from './roster'

/** A failure in the error colour with an alert icon, announced to screen readers when it shows. */
export function ProblemMessage({ problem }: { problem: RosterProblem }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <p role="alert" className="flex gap-2 text-base text-destructive-text">
      <CircleAlert aria-hidden size={16} className="mt-1 shrink-0" />
      <span>
        {t(problem.key)}
        {problem.detail && <span className="block text-sm">{problem.detail}</span>}
      </span>
    </p>
  )
}

/** A failed load with its Try again link. */
export function TryAgain({
  problem,
  onRetry
}: {
  problem: RosterProblem
  onRetry: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div>
      <ProblemMessage problem={problem} />
      <button className="mt-2 underline underline-offset-4 hover:decoration-2" onClick={onRetry}>
        {t('action.tryAgain')}
      </button>
    </div>
  )
}
