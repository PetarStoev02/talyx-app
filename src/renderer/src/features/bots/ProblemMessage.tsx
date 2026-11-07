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
