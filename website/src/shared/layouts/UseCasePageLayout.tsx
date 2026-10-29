import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { features, useCases } from '../data/navigation'
import { ABILITY_COUNT } from '../data/offer'
import { ApprovalCard } from '../ui/ApprovalCard'
import { AppScreenshot, Body, GUTTER, ItemTitle, PageHero, SectionHeading } from '../ui/page'
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

function stagger(i: number): React.CSSProperties {
  return { '--i': i } as React.CSSProperties
}

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

  const useCase = useCases.find((u) => u.slug === slug)
  const relatedFeatures = features.filter((f) => relatedFeatureSlugs.includes(f.slug))

  return (
    <>
      <PageHero title={title} lead={lead}>
        {useCase ? (
          <figure>
            <div className="relative isolate flex items-center justify-center overflow-hidden rounded-2xl p-6 md:aspect-[16/11] md:p-10">
              <img
                src="/hero-wallpaper.jpg"
                alt=""
                width={2200}
                height={1238}
                className="absolute inset-0 -z-10 size-full object-cover object-right"
              />
              <ApprovalCard plan={useCase.plan} />
            </div>
            <figcaption
              className="mt-4 text-[var(--color-text-primary)]"
              style={{ fontSize: 'var(--step-body)' }}
            >
              A card Talyx might show you. Nothing moves until you approve.
            </figcaption>
          </figure>
        ) : null}
      </PageHero>

      <section className={`${SECTION} bg-[var(--color-bg-secondary)]`}>
        <SectionHeading>The problem.</SectionHeading>
        <div className="mt-16 grid gap-x-16 gap-y-14 md:grid-cols-2">
          {painPoints.map((item, i) => (
            <div key={item.title} data-reveal style={stagger(i)}>
              <ItemTitle>{item.title}</ItemTitle>
              <p
                className="mt-3 max-w-[48ch] leading-snug text-[var(--color-text-primary)]"
                style={{ fontSize: 'var(--step-lead)' }}
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className={SECTION}>
        <SectionHeading>How Talyx helps.</SectionHeading>
        <div className="mt-16 grid items-start gap-12 md:grid-cols-12 md:gap-8">
          <div data-reveal className="md:sticky md:top-32 md:col-span-7">
            <AppScreenshot src={screenshot} alt={`Talyx: ${solutions[0]?.title ?? title}`} />
          </div>
          <div className="space-y-12 md:col-span-4 md:col-start-9">
            {solutions.map((item, i) => (
              <div key={item.title} data-reveal style={stagger(i + 1)}>
                <ItemTitle>{item.title}</ItemTitle>
                <Body className="mt-3">{item.description}</Body>
              </div>
            ))}
          </div>
        </div>
      </section>

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
              style={{ fontSize: 'var(--step-body)' }}
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

      <section className={SECTION}>
        <SectionHeading>Related features.</SectionHeading>
        <ul className="mt-16 space-y-10 md:space-y-12">
          {relatedFeatures.map((f, i) => (
            <li key={f.slug} data-reveal style={stagger(i)}>
              <Link
                to="/features/$slug"
                params={{ slug: f.slug }}
                className="group grid items-baseline gap-3 text-[var(--color-text-primary)] md:grid-cols-12 md:gap-8"
              >
                <span
                  className="flex items-baseline gap-3 leading-none font-semibold tracking-[-0.035em] underline-offset-[0.12em] group-hover:underline md:col-span-7"
                  style={{ fontSize: 'var(--step-heading)' }}
                >
                  {f.title}
                  <ArrowRight className="size-[0.6em] shrink-0 self-center transition-transform group-hover:translate-x-1" />
                </span>
                <span className="md:col-span-5" style={{ fontSize: 'var(--step-body)' }}>
                  {f.shortDescription}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <DownloadSection />
    </>
  )
}
