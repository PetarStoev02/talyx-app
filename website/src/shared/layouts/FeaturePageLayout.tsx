import { Link } from '@tanstack/react-router'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { features, type FeatureNav } from '../data/navigation'
import {
  AppScreenshot,
  Body,
  GUTTER,
  ItemTitle,
  PageHero,
  SectionHeading,
  STEP,
  stagger
} from '../ui/page'
import { DownloadSection } from '../../widgets/download/DownloadSection'

export interface FeaturePoint {
  title: string
  description: string
}

interface FeaturePageLayoutProps {
  slug: string
  title: string
  lead: string
  steps: FeaturePoint[]
  benefits: FeaturePoint[]
  stepsHeading?: string
  benefitsHeading?: string
  /** Shown beside the lead instead of the feature's screenshot. */
  figure?: React.ReactNode
}

const RELATED_COUNT = 3

/** Every feature page: the hero and its screenshot, the steps, the benefits, related features, the download close. */
export function FeaturePageLayout({
  slug,
  title,
  lead,
  steps,
  benefits,
  stepsHeading = 'How it works',
  benefitsHeading = 'Why it helps',
  figure
}: FeaturePageLayoutProps) {
  useDocumentTitle(title)

  const related = features.filter((f) => f.slug !== slug).slice(0, RELATED_COUNT)
  const preview = features.find((f) => f.slug === slug)?.preview ?? null

  return (
    <>
      <PageHero title={title} lead={lead}>
        {figure ?? (preview ? <AppScreenshot src={preview} alt={`Talyx: ${title}`} /> : null)}
      </PageHero>
      <HowItWorks heading={stepsHeading} steps={steps} />
      <Benefits heading={benefitsHeading} benefits={benefits} />
      <MoreFeatures related={related} />
      <DownloadSection />
    </>
  )
}

function HowItWorks({ heading, steps }: { heading: string; steps: FeaturePoint[] }) {
  return (
    <section className={`${GUTTER} grid gap-12 py-32 md:grid-cols-12 md:py-48`}>
      <div className="md:sticky md:top-32 md:col-span-4 md:self-start">
        <SectionHeading>{heading}</SectionHeading>
      </div>
      <ol className="space-y-20 md:col-span-7 md:col-start-6 md:space-y-28">
        {steps.map((step, i) => (
          <li key={step.title} data-reveal style={stagger(i)}>
            <h3
              className="leading-none font-semibold tracking-[-0.035em] text-[var(--color-text-primary)]"
              style={STEP.heading}
            >
              {step.title}
            </h3>
            <Body className="mt-6">{step.description}</Body>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Benefits({ heading, benefits }: { heading: string; benefits: FeaturePoint[] }) {
  return (
    <section className={`${GUTTER} py-32 md:py-48`}>
      <SectionHeading>{heading}</SectionHeading>
      <ul className="mt-16 grid gap-x-16 gap-y-14 md:mt-24 md:grid-cols-2 md:gap-y-20">
        {benefits.map((benefit, i) => (
          <li key={benefit.title} data-reveal style={stagger(i % 2)}>
            <ItemTitle>{benefit.title}</ItemTitle>
            <Body className="mt-3">{benefit.description}</Body>
          </li>
        ))}
      </ul>
    </section>
  )
}

function MoreFeatures({ related }: { related: FeatureNav[] }) {
  return (
    <section className={`${GUTTER} py-32 md:py-48`}>
      <SectionHeading>More of Talyx</SectionHeading>
      <ul className="mt-16 space-y-20 md:mt-24 md:space-y-32">
        {related.map((f) => (
          <li key={f.slug} data-reveal>
            <Link
              to="/features/$slug"
              params={{ slug: f.slug }}
              className="group grid items-center gap-8 md:grid-cols-12"
            >
              <div className="md:col-span-5">
                <span
                  className="block leading-none font-semibold tracking-[-0.035em] text-[var(--color-text-primary)] underline-offset-8 group-hover:underline"
                  style={STEP.heading}
                >
                  {f.title}
                </span>
                <span
                  className="mt-5 block max-w-[40ch] text-[var(--color-text-primary)]"
                  style={STEP.body}
                >
                  {f.shortDescription}
                </span>
              </div>
              {f.preview ? (
                <div className="md:col-span-6 md:col-start-7">
                  <AppScreenshot src={f.preview} alt="" />
                </div>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
