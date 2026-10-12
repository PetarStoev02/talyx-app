import { lazy, Suspense } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { getPostBySlug, posts, categoryMeta } from '@/shared/data/posts'
const TalyxIsNowFreeAndOpenSource = lazy(() =>
  import('./posts/talyx-is-now-free-and-open-source').then((m) => ({
    default: m.TalyxIsNowFreeAndOpenSource
  }))
)
const MeetTheAssistant = lazy(() =>
  import('./posts/meet-the-assistant').then((m) => ({ default: m.MeetTheAssistant }))
)

const postComponents: Record<string, React.LazyExoticComponent<() => React.JSX.Element>> = {
  'talyx-is-now-free-and-open-source': TalyxIsNowFreeAndOpenSource,
  'meet-the-assistant': MeetTheAssistant
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export function BlogPostPage() {
  const { slug } = useParams({ from: '/blog/$slug' })
  const post = getPostBySlug(slug)
  const Component = postComponents[slug]
  const showDrafts =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('drafts')
  const isDraftHidden = post?.draft && !showDrafts

  if (!post || !Component || isDraftHidden) {
    return (
      <section className="px-4 pt-20 pb-20 sm:px-6 sm:pt-28 sm:pb-28">
        <div className="mx-auto max-w-[700px] text-center">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Post not found</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            This post hasn&apos;t been published yet or doesn&apos;t exist.
          </p>
          <Link
            to="/blog"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="size-3.5" />
            Back to blog
          </Link>
        </div>
      </section>
    )
  }

  // Get related posts (same category, different slug, max 3)
  const related = posts
    .filter((p) => p.category === post.category && p.slug !== post.slug && postComponents[p.slug])
    .slice(0, 3)

  return (
    <>
      <article className="px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-20">
        <div className="mx-auto max-w-[700px]">
          {/* Back link */}
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="size-3.5" />
            Back to blog
          </Link>

          {/* Meta */}
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--color-btn-primary-bg)]/10 px-3 py-1 text-xs font-medium text-[var(--color-btn-primary-bg)]">
              {categoryMeta[post.category].label}
            </span>
            {post.draft && (
              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                Draft
              </span>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            {post.updatedAt && (
              <>
                <span>&middot;</span>
                <span>Updated {formatDate(post.updatedAt)}</span>
              </>
            )}
            <span>&middot;</span>
            <span>{post.readTime}</span>
          </div>

          {/* Title */}
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
            {post.title}
          </h1>

          {/* Divider */}
          <div className="mt-8 border-t border-[var(--color-border)]" />

          {/* Content */}
          <div className="prose mt-8 space-y-5 text-[15px] leading-[1.75] text-[var(--color-text-secondary)] sm:text-base [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-[var(--color-text-primary)] sm:[&_h2]:text-2xl [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-[var(--color-text-primary)] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_li]:pl-1 [&_code]:rounded [&_code]:bg-[var(--color-surface)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-[var(--color-text-primary)] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[var(--color-surface)] [&_pre]:p-4 [&_pre]:text-sm [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_strong]:text-[var(--color-text-primary)] [&_table]:w-full [&_table]:text-sm [&_th]:border [&_th]:border-[var(--color-border)] [&_th]:bg-[var(--color-surface)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-[var(--color-text-primary)] [&_td]:border [&_td]:border-[var(--color-border)] [&_td]:px-3 [&_td]:py-2">
            <Suspense fallback={null}>
              <Component />
            </Suspense>
          </div>
        </div>
      </article>

      {/* Related Posts */}
      {related.length > 0 && (
        <section className="border-t border-[var(--color-border)] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-[700px]">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Related articles
            </h2>
            <div className="mt-6 space-y-4">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  to="/blog/$slug"
                  params={{ slug: r.slug }}
                  className="group flex items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-text-tertiary)]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {r.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {formatDate(r.date)} &middot; {r.readTime}
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-[var(--color-text-tertiary)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--color-btn-primary-bg)]" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
