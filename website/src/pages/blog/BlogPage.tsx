import { Link } from '@tanstack/react-router'
import { ArrowRight, Download } from 'lucide-react'
import { useState } from 'react'
import { posts, categoryMeta, type BlogCategory } from '@/shared/data/posts'
import { REPO_URL } from '@/shared/data/release'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export function BlogPage() {
  const [active, setActive] = useState<BlogCategory | 'all'>('all')

  const showDrafts =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('drafts')
  const visible = showDrafts ? posts : posts.filter((p) => !p.draft)
  const allCategories: (BlogCategory | 'all')[] = [
    'all',
    ...(Object.keys(categoryMeta) as BlogCategory[]).filter((cat) =>
      visible.some((p) => p.category === cat)
    )
  ]
  const filtered = active === 'all' ? visible : visible.filter((p) => p.category === active)
  const featured = filtered.find((p) => p.featured) ?? filtered[0]
  const rest = filtered.filter((p) => p !== featured)

  return (
    <>
      {/* Hero */}
      <section className="px-4 pt-20 pb-4 sm:px-6 sm:pt-28">
        <div className="mx-auto max-w-[1100px]">
          <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-5xl">
            Blog
          </h1>
          <p className="mt-3 max-w-[520px] text-base leading-relaxed text-[var(--color-text-secondary)] sm:text-lg">
            Insights on AI file organization, privacy-first software, and taming digital chaos.
          </p>
        </div>
      </section>

      {/* Category Filters */}
      <section className="sticky top-16 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 px-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto max-w-[1100px]">
          <nav
            className="scrollbar-none -mb-px flex gap-1 overflow-x-auto py-3"
            aria-label="Blog categories"
          >
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  active === cat
                    ? 'bg-[var(--color-text-primary)] text-[var(--color-bg)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {cat === 'all' ? 'All Posts' : categoryMeta[cat].label}
              </button>
            ))}
          </nav>
        </div>
      </section>

      {/* Featured Post */}
      {featured && (
        <section className="px-4 pt-10 sm:px-6">
          <div className="mx-auto max-w-[1100px]">
            <Link
              to="/blog/$slug"
              params={{ slug: featured.slug }}
              className="group relative block overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-[var(--color-text-tertiary)]"
            >
              <div className="p-8 sm:p-10 lg:p-12">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--color-btn-primary-bg)]/10 px-3 py-1 text-xs font-medium text-[var(--color-btn-primary-bg)]">
                    {categoryMeta[featured.category].label}
                  </span>
                  {featured.draft && (
                    <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                      Draft
                    </span>
                  )}
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {formatDate(featured.date)}
                  </span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">&middot;</span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {featured.readTime}
                  </span>
                </div>

                <h2 className="mt-5 max-w-[700px] text-2xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-3xl lg:text-4xl">
                  {featured.title}
                </h2>

                <p className="mt-3 max-w-[600px] text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
                  {featured.excerpt}
                </p>

                <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-btn-primary-bg)]">
                  Read article
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Post Grid */}
      {rest.length > 0 && (
        <section className="px-4 pt-8 pb-20 sm:px-6 sm:pb-28">
          <div className="mx-auto max-w-[1100px]">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <Link
                  key={post.slug}
                  to="/blog/$slug"
                  params={{ slug: post.slug }}
                  className="group flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-text-tertiary)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--color-surface-hover)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                      {categoryMeta[post.category].label}
                    </span>
                    {post.draft && (
                      <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        Draft
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-base font-semibold leading-snug text-[var(--color-text-primary)] sm:text-lg">
                    {post.title}
                  </h3>

                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                    {post.excerpt}
                  </p>

                  <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      {formatDate(post.date)} &middot; {post.readTime}
                    </span>
                    <ArrowRight className="size-4 text-[var(--color-text-tertiary)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--color-btn-primary-bg)]" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-[1100px] text-center">
            <p className="text-sm text-[var(--color-text-tertiary)]">
              No posts in this category yet. Check back soon.
            </p>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="border-t border-[var(--color-border)] px-4 sm:px-6">
        <div className="mx-auto grid max-w-[1100px] gap-8 py-16 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
              Ready to organize?{' '}
              <span className="text-[var(--color-text-secondary)]">
                Start sorting files for free.
              </span>
            </h2>
            <p className="mt-3 max-w-[500px] text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
              Talyx is free and open source — read the code on{' '}
              <a
                href={REPO_URL}
                className="font-medium text-[var(--color-btn-primary-bg)] hover:underline"
              >
                GitHub
              </a>
              .
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/#download"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-text-primary)] px-5 py-2.5 text-sm font-medium text-[var(--color-bg)] transition-opacity hover:opacity-90"
              >
                <Download className="size-4" />
                Download for Mac
              </a>
              <a
                href={REPO_URL}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                View on GitHub
              </a>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:min-w-[280px]">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Explore all features
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              AI classification, watch folders, smart rename, full undo history, and more.
            </p>
            <Link
              to="/features/$slug"
              params={{ slug: 'ai-classification' }}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-btn-primary-bg)] hover:underline"
            >
              See features
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
