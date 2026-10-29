import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle'
import { features, useCaseBySlug, type FeatureNav } from '../../shared/data/navigation'
import { ABILITY_COUNT } from '../../shared/data/offer'
import type { Plan } from '../../shared/data/plan'
import { ApprovalFigure } from '../../shared/ui/ApprovalCard'
import {
  AppScreenshot,
  Body,
  GUTTER,
  ItemTitle,
  PageHero,
  SectionHeading,
  STEP,
  stagger
} from '../../shared/ui/page'
import { DownloadSection } from '../../widgets/download/DownloadSection'

interface Statement {
  title: string
  description: string
}

interface UseCasePageLayoutProps {
  /** Matches an entry in navigation.ts `useCases`, whose sample plan the hero shows. */
  slug: string
  title: string
  lead: string
  /** A screenshot from /previews shown beside the solutions. */
  screenshot: string
  relatedFeatureSlugs: string[]
  painPoints: Statement[]
  solutions: Statement[]
}

const SECTION = `${GUTTER} py-32 md:py-48`

export function UseCasePageLayout({
  slug,
  title,
  lead,
  screenshot,
  relatedFeatureSlugs,
  painPoints,
  solutions
}: UseCasePageLayoutProps) {
  useDocumentTitle(title)

  const { plan } = useCaseBySlug(slug)
  const relatedFeatures = features.filter((f) => relatedFeatureSlugs.includes(f.slug))

  return (
    <>
      <PageHero title={title} lead={lead}>
        <SamplePlan plan={plan} />
      </PageHero>
      <PainPoints items={painPoints} />
      <Solutions items={solutions} screenshot={screenshot} fallbackAlt={title} />
      <AssistantTeaser />
      <RelatedFeatures items={relatedFeatures} />
      <DownloadSection />
    </>
  )
}

function SamplePlan({ plan }: { plan: Plan }) {
  return (
    <figure>
      <ApprovalFigure plan={plan} className="p-6 md:aspect-[16/11] md:p-10" />
      <figcaption className="mt-4 text-[var(--color-text-primary)]" style={STEP.body}>
        A card Talyx might show you. Nothing moves until you approve.
      </figcaption>
    </figure>
  )
}

function PainPoints({ items }: { items: Statement[] }) {
  return (
    <section className={`${SECTION} bg-[var(--color-bg-secondary)]`}>
      <SectionHeading>The problem.</SectionHeading>
      <div className="mt-16 grid gap-x-16 gap-y-14 md:grid-cols-2">
        {items.map((item, i) => (
          <div key={item.title} data-reveal style={stagger(i)}>
            <ItemTitle>{item.title}</ItemTitle>
            <p
              className="mt-3 max-w-[48ch] leading-snug text-[var(--color-text-primary)]"
              style={STEP.lead}
            >
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Solutions({
  items,
  screenshot,
  fallbackAlt
}: {
  items: Statement[]
  screenshot: string
  fallbackAlt: string
}) {
  return (
    <section className={SECTION}>
      <SectionHeading>How Talyx helps.</SectionHeading>
      <div className="mt-16 grid items-start gap-12 md:grid-cols-12 md:gap-8">
        <div data-reveal className="md:sticky md:top-32 md:col-span-7">
          <AppScreenshot src={screenshot} alt={`Talyx: ${items[0]?.title ?? fallbackAlt}`} />
        </div>
        <div className="space-y-12 md:col-span-4 md:col-start-9">
          {items.map((item, i) => (
            <div key={item.title} data-reveal style={stagger(i + 1)}>
              <ItemTitle>{item.title}</ItemTitle>
              <Body className="mt-3">{item.description}</Body>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function AssistantTeaser() {
  return (
    <section className={`${SECTION} grid items-center gap-12 md:grid-cols-12 md:gap-8`}>
      <div className="md:col-span-5">
        <SectionHeading>One of {ABILITY_COUNT} abilities.</SectionHeading>
        <div data-reveal style={stagger(1)} className="mt-8">
          <Body>
            Sorting is one ability. Press ⌘⇧Space to check today&apos;s calendar, add a reminder,
            read unread mail or run a command, with your own Claude, after you approve.
          </Body>
          <Link
            to="/features/$slug"
            params={{ slug: 'assistant' }}
            className="mt-6 inline-flex items-center gap-2 font-medium text-[var(--color-text-primary)] underline underline-offset-4 transition-opacity hover:opacity-70"
            style={STEP.body}
          >
            Meet the assistant
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
      <div data-reveal style={stagger(2)} className="md:col-span-7 md:col-start-6">
        <AppScreenshot src="/previews/suggestions.jpg" alt="Talyx: the assistant" />
      </div>
    </section>
  )
}

function RelatedFeatures({ items }: { items: FeatureNav[] }) {
  return (
    <section className={SECTION}>
      <SectionHeading>Related features.</SectionHeading>
      <ul className="mt-16 space-y-10 md:space-y-12">
        {items.map((f, i) => (
          <li key={f.slug} data-reveal style={stagger(i)}>
            <Link
              to="/features/$slug"
              params={{ slug: f.slug }}
              className="group grid items-baseline gap-3 text-[var(--color-text-primary)] md:grid-cols-12 md:gap-8"
            >
              <span
                className="flex items-baseline gap-3 leading-none font-semibold tracking-[-0.035em] underline-offset-[0.12em] group-hover:underline md:col-span-7"
                style={STEP.heading}
              >
                {f.title}
                <ArrowRight className="size-[0.6em] shrink-0 self-center transition-transform group-hover:translate-x-1" />
              </span>
              <span className="md:col-span-5" style={STEP.body}>
                {f.shortDescription}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
