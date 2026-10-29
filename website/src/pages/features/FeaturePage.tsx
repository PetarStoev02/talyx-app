import { lazy, Suspense } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { PageHero } from '../../shared/ui/page'

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
      <PageHero title="Feature not found" lead="There is no Talyx feature at this address.">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-medium text-[var(--color-text-primary)] underline underline-offset-4 transition-opacity hover:opacity-70"
          style={{ fontSize: 'var(--step-lead)' }}
        >
          Go to the home page
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
