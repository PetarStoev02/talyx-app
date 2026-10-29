import { lazy, Suspense } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { PageHero, STEP } from '../../shared/ui/page'

const KnowledgeWorkersPage = lazy(() =>
  import('./pages/KnowledgeWorkersPage').then((m) => ({ default: m.KnowledgeWorkersPage }))
)
const FreelancersPage = lazy(() =>
  import('./pages/FreelancersPage').then((m) => ({ default: m.FreelancersPage }))
)
const StudentsPage = lazy(() =>
  import('./pages/StudentsPage').then((m) => ({ default: m.StudentsPage }))
)
const LegalPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.LegalPage })))
const MedicalPage = lazy(() =>
  import('./pages/MedicalPage').then((m) => ({ default: m.MedicalPage }))
)

const useCasePages: Record<string, React.LazyExoticComponent<() => React.JSX.Element>> = {
  'knowledge-workers': KnowledgeWorkersPage,
  freelancers: FreelancersPage,
  students: StudentsPage,
  legal: LegalPage,
  medical: MedicalPage
}

export function UseCasePage() {
  const { slug } = useParams({ from: '/use-cases/$slug' })
  const Page = useCasePages[slug]

  if (!Page) {
    return (
      <PageHero title="Use case not found" lead="The use case you’re looking for doesn’t exist.">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-medium text-[var(--color-text-primary)] underline underline-offset-4 transition-opacity hover:opacity-70"
          style={STEP.body}
        >
          Back to home
          <ArrowRight className="size-4" />
        </Link>
      </PageHero>
    )
  }

  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  )
}
