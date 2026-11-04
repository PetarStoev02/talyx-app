import { useLanguage } from '@app/providers/useLanguage'
import type { RosterProblem } from './roster'

export function ProblemMessage({ problem }: { problem: RosterProblem }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <p className="text-base">
      {t(problem.key)}
      {problem.detail && <span className="block text-sm">{problem.detail}</span>}
    </p>
  )
}
