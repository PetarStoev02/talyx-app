import { Link, useParams } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { PageHero, STEP } from '../../shared/ui/page'
import { featurePages } from './featurePages'

export function FeaturePage() {
  const { slug } = useParams({ from: '/features/$slug' })
  const Page = featurePages.get(slug)

  if (!Page) {
    return (
      <PageHero title="Feature not found" lead="There is no Talyx feature at this address.">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-medium text-[var(--color-text-primary)] underline underline-offset-4 transition-opacity hover:opacity-70"
          style={STEP.lead}
        >
          Go to the home page
          <ArrowRight className="size-4" />
        </Link>
      </PageHero>
    )
  }

  return <Page />
}
