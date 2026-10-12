import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { features, type NavItem } from '../data/navigation'
import { REPO_URL } from '../data/release'
interface FeaturePageLayoutProps {
  slug: string
  title: string
  subtitle: string
  icon: NavItem['icon']
  heroIllustration: React.ReactNode
  children: React.ReactNode
}

export function FeaturePageLayout({
  slug,
  title,
  subtitle,
  icon: Icon,
  heroIllustration,
  children
}: FeaturePageLayoutProps) {
  useDocumentTitle(title)

  const related = features.filter((f) => f.slug !== slug).slice(0, 3)

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-16 pb-12 sm:px-6 sm:pt-24 sm:pb-16">
        <div className="page-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-[800px]">
          <Link
            to="/"
            hash="features"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="size-3.5" />
            All features
          </Link>
          <div className="mt-8 flex size-14 items-center justify-center rounded-2xl bg-[var(--color-icon-bg)] text-[var(--color-text-primary)]">
            <Icon className="size-7" />
          </div>
          <h1 className="mt-6 text-[32px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[48px]">
            {title}
          </h1>
          <p className="mt-4 max-w-[600px] text-[17px] leading-relaxed text-[var(--color-text-secondary)]">
            {subtitle}
          </p>
          <div className="mt-10">{heroIllustration}</div>
        </div>
      </section>

      {/* Page content */}
      <section className="px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="mx-auto max-w-[800px]">{children}</div>
      </section>

      {/* Related features */}
      <section className="border-t border-[var(--color-border)] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="mb-8 text-center text-[20px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[24px]">
            Related Features
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {related.map((f) => (
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

      {/* Bottom CTA */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-[800px] text-center">
          <h2 className="text-[24px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[32px]">
            Ready to tell your Mac what to do?
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
