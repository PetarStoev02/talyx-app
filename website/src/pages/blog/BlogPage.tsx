import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { posts, categoryMeta, type BlogCategory, type BlogPost } from '@/shared/data/posts'
import { AppScreenshot, GUTTER, PageHero, SectionHeading } from '@/shared/ui/page'
import { DownloadSection } from '@/widgets/download/DownloadSection'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/** Date, read time, category and draft state on one quiet line under a title. */
function postMeta(post: BlogPost): string {
  return [
    formatDate(post.date),
    post.readTime,
    categoryMeta[post.category].label,
    post.draft ? 'Draft' : null
  ]
    .filter(Boolean)
    .join(' · ')
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
      <PageHero
        title="Blog"
        lead="Releases, and how Talyx is built: what changed, why, and what it means for your Mac."
      >
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Blog categories">
          {allCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActive(cat)}
              aria-pressed={active === cat}
              className={`min-h-11 font-medium text-[var(--color-text-primary)] underline-offset-8 transition-opacity hover:opacity-70 ${
                active === cat ? 'underline decoration-2' : ''
              }`}
              style={{ fontSize: 'var(--step-lead)' }}
            >
              {cat === 'all' ? 'All posts' : categoryMeta[cat].label}
            </button>
          ))}
        </nav>
      </PageHero>

      {featured ? (
        <section className={`${GUTTER} py-16 md:py-24`}>
          <SectionHeading>Latest</SectionHeading>
          <Link
            to="/blog/$slug"
            params={{ slug: featured.slug }}
            data-reveal
            style={{ '--i': 1 } as React.CSSProperties}
            className="group mt-12 grid gap-6 md:mt-16 md:grid-cols-12"
          >
            <div className="md:col-span-6">
              <h3
                className="leading-[1.02] font-semibold tracking-[-0.04em] text-[var(--color-text-primary)] underline-offset-[0.12em] group-hover:underline"
                style={{ fontSize: 'var(--step-heading)' }}
              >
                {featured.title}
              </h3>
              <p
                className="mt-6 max-w-[48ch] leading-snug text-[var(--color-text-primary)]"
                style={{ fontSize: 'var(--step-lead)' }}
              >
                {featured.excerpt}
              </p>
              <p
                className="mt-4 text-[var(--color-text-secondary)]"
                style={{ fontSize: 'var(--step-small)' }}
              >
                {postMeta(featured)}
              </p>
            </div>
            <div className="transition-transform duration-300 group-hover:-translate-y-1 md:col-span-6">
              <AppScreenshot src={featured.cover} alt="" />
            </div>
          </Link>
        </section>
      ) : (
        <section className={`${GUTTER} py-16 md:py-24`}>
          <SectionHeading>Nothing here yet</SectionHeading>
          <p
            className="mt-8 text-[var(--color-text-primary)]"
            style={{ fontSize: 'var(--step-body)' }}
          >
            No posts in this category yet. Check back soon.
          </p>
        </section>
      )}

      {rest.length > 0 && (
        <section className={`${GUTTER} py-16 md:py-24`}>
          <SectionHeading>Earlier posts</SectionHeading>
          <div className="mt-12 md:mt-16">
            <ul className="space-y-16">
              {rest.map((post, i) => (
                <li key={post.slug} data-reveal style={{ '--i': i } as React.CSSProperties}>
                  <Link
                    to="/blog/$slug"
                    params={{ slug: post.slug }}
                    className="group grid gap-6 md:grid-cols-12 md:gap-8"
                  >
                    <div className="md:col-span-4">
                      <AppScreenshot src={post.cover} alt="" />
                    </div>
                    <div className="md:col-span-7 md:col-start-6">
                      <h3
                        className="leading-tight font-semibold text-[var(--color-text-primary)] underline-offset-4 group-hover:underline"
                        style={{ fontSize: 'var(--step-lead)' }}
                      >
                        {post.title}
                      </h3>
                      <p
                        className="mt-3 max-w-[60ch] leading-relaxed text-[var(--color-text-primary)]"
                        style={{ fontSize: 'var(--step-body)' }}
                      >
                        {post.excerpt}
                      </p>
                      <p
                        className="mt-3 text-[var(--color-text-secondary)]"
                        style={{ fontSize: 'var(--step-small)' }}
                      >
                        {postMeta(post)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <DownloadSection />
    </>
  )
}
