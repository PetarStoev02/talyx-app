import { Link } from '@tanstack/react-router'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { features, type NavItem } from '../data/navigation'
import { ABILITY_COUNT } from '../data/offer'
import { REPO_URL } from '../data/release'

interface PainPoint {
  icon: LucideIcon
  title: string
  description: string
}

interface Solution {
  title: string
  description: string
}

interface UseCasePageLayoutProps {
  title: string
  subtitle: string
  persona: string
  icon: NavItem['icon']
  relatedFeatureSlugs: string[]
  painPoints: PainPoint[]
  solutions: Solution[]
  heroIllustration: React.ReactNode
}

export function UseCasePageLayout({
  title,
  subtitle,
  persona,
  icon: Icon,
  relatedFeatureSlugs,
  painPoints,
  solutions,
  heroIllustration
}: UseCasePageLayoutProps) {
  useDocumentTitle(title)

  const relatedFeatures = features.filter((f) => relatedFeatureSlugs.includes(f.slug))

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-20 pb-16 sm:px-6 sm:pt-32 sm:pb-24">
        <div className="page-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-[800px] text-center">
          <span className="inline-block rounded-full border border-[var(--color-badge-border)] bg-[var(--color-badge-bg)] px-3.5 py-1 text-[13px] font-medium text-[var(--color-badge-text)]">
            {persona}
          </span>
          <div className="mt-6 flex justify-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-[var(--color-icon-bg)] text-[var(--color-text-primary)]">
              <Icon className="size-8" />
            </div>
          </div>
          <h1 className="mt-8 text-[36px] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--color-text-primary)] sm:text-[56px]">
            {title}
          </h1>
          <p className="mx-auto mt-5 max-w-[640px] text-[18px] leading-relaxed text-[var(--color-text-secondary)]">
            {subtitle}
          </p>
          <div className="mt-10">{heroIllustration}</div>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="/#download"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-btn-primary-bg)] px-7 py-3 text-[15px] font-semibold text-[var(--color-btn-primary-text)] transition-all hover:-translate-y-px hover:shadow-[0_4px_20px_var(--color-btn-primary-hover-shadow)]"
            >
              Download for macOS
              <ArrowRight className="size-4" />
            </a>
            <a
              href={REPO_URL}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-btn-secondary-border)] bg-[var(--color-btn-secondary-bg)] px-7 py-3 text-[15px] font-semibold text-[var(--color-btn-secondary-text)] transition-all hover:border-[var(--color-btn-secondary-hover-border)] hover:shadow-[0_4px_20px_var(--color-btn-secondary-hover-shadow)]"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* The Challenge */}
      <section className="border-t border-[var(--color-border)] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="mb-12 text-center text-[24px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[32px]">
            The Challenge
          </h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {painPoints.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8"
              >
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-[var(--color-icon-bg)] text-[var(--color-text-primary)]">
                  <item.icon className="size-6" />
                </div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-tertiary)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How Talyx Solves This */}
      <section className="border-t border-[var(--color-border)] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-[800px]">
          <h2 className="mb-12 text-center text-[24px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[32px]">
            How Talyx Solves This
          </h2>
          <div className="space-y-5">
            {solutions.map((item, i) => (
              <div
                key={item.title}
                className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8 transition-all hover:border-l-[var(--color-btn-primary-bg)] hover:bg-[var(--color-surface-hover)]"
              >
                <div className="flex items-start gap-5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[13px] font-semibold text-[var(--color-text-tertiary)] transition-colors group-hover:border-[var(--color-btn-primary-bg)] group-hover:text-[var(--color-text-primary)]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-tertiary)]">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related Features */}
      <section className="border-t border-[var(--color-border)] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="mb-8 text-center text-[20px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[24px]">
            Related Features
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {relatedFeatures.map((f) => (
              <Link
                key={f.slug}
                to="/features/$slug"
                params={{ slug: f.slug }}
                className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-[var(--color-icon-bg)] text-[var(--color-text-primary)]">
                  <f.icon className="size-5" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {f.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
                  {f.shortDescription}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* The assistant, one line */}
      <section className="border-t border-[var(--color-border)] px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto flex max-w-[800px] flex-col items-start gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Sorting is one ability. The assistant has {ABILITY_COUNT}.
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Cmd+Shift+Space: check today&apos;s calendar, add a reminder, read unread mail, run a
              command — with your own Claude, after you approve.
            </p>
          </div>
          <Link
            to="/features/$slug"
            params={{ slug: 'assistant' }}
            className="shrink-0 text-sm font-medium text-[var(--color-text-primary)] underline underline-offset-4"
          >
            Meet the assistant
          </Link>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-[800px] text-center">
          <h2 className="text-[24px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[32px]">
            Ready to organize your files?
          </h2>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            Free and open source. MIT licensed.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="/#download"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-btn-primary-bg)] px-7 py-3 text-[15px] font-semibold text-[var(--color-btn-primary-text)] transition-all hover:-translate-y-px hover:shadow-[0_4px_20px_var(--color-btn-primary-hover-shadow)]"
            >
              Download for macOS
              <ArrowRight className="size-4" />
            </a>
            <a
              href={REPO_URL}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-btn-secondary-border)] bg-[var(--color-btn-secondary-bg)] px-7 py-3 text-[15px] font-semibold text-[var(--color-btn-secondary-text)] transition-all hover:border-[var(--color-btn-secondary-hover-border)] hover:shadow-[0_4px_20px_var(--color-btn-secondary-hover-shadow)]"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
