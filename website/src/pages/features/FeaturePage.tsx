import { Link, useParams } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { features } from '../../shared/data/navigation'
import { PageHero, STEP } from '../../shared/ui/page'
import { FeaturePageLayout } from './FeaturePageLayout'

export function FeaturePage() {
  const { slug } = useParams({ from: '/features/$slug' })
  const feature = features.find((f) => f.slug === slug)

  if (!feature) {
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

  return (
    <FeaturePageLayout
      slug={feature.slug}
      title={feature.title}
      lead={feature.shortDescription}
      steps={[]}
      benefits={[]}
    />
  )
}
