import { lazy, Suspense } from 'react'
import { useParams } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
const AiClassificationPage = lazy(() =>
  import('./pages/AiClassificationPage').then((m) => ({ default: m.AiClassificationPage }))
)
const WatchFoldersPage = lazy(() =>
  import('./pages/WatchFoldersPage').then((m) => ({ default: m.WatchFoldersPage }))
)
const SmartRenamePage = lazy(() =>
  import('./pages/SmartRenamePage').then((m) => ({ default: m.SmartRenamePage }))
)
const SortHistoryPage = lazy(() =>
  import('./pages/SortHistoryPage').then((m) => ({ default: m.SortHistoryPage }))
)
const DragAndDropPage = lazy(() =>
  import('./pages/DragAndDropPage').then((m) => ({ default: m.DragAndDropPage }))
)
const PrivacyOfflinePage = lazy(() =>
  import('./pages/PrivacyOfflinePage').then((m) => ({ default: m.PrivacyOfflinePage }))
)
const AssistantPage = lazy(() =>
  import('./pages/AssistantPage').then((m) => ({ default: m.AssistantPage }))
)

const featurePages: Record<string, React.LazyExoticComponent<() => React.JSX.Element>> = {
  'ai-classification': AiClassificationPage,
  'watch-folders': WatchFoldersPage,
  'smart-rename': SmartRenamePage,
  'sort-history': SortHistoryPage,
  'drag-and-drop': DragAndDropPage,
  'privacy-offline': PrivacyOfflinePage,
  assistant: AssistantPage,
  // Old links to the search overlay land on its successor.
  'quick-search': AssistantPage
}

export function FeaturePage() {
  const { slug } = useParams({ from: '/features/$slug' })
  const Page = featurePages[slug]

  if (!Page) {
    return (
      <section className="px-4 pt-20 pb-20 sm:px-6 sm:pt-28 sm:pb-28">
        <div className="mx-auto max-w-[700px] text-center">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Feature not found</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            The feature you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            to="/"
            hash="features"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="size-3.5" />
            Back to features
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
