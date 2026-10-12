import { lazy, Suspense } from 'react'
import { useParams } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
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
      <section className="px-4 pt-20 pb-20 sm:px-6 sm:pt-28 sm:pb-28">
        <div className="mx-auto max-w-[700px] text-center">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Use case not found
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            The use case you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="size-3.5" />
            Back to home
          </Link>
        </div>
      </section>
    )
  }

  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  )
}
