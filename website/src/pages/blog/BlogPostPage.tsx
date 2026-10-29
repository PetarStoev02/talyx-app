import { lazy, Suspense } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { getPostBySlug, posts, categoryMeta } from '@/shared/data/posts'
import { AppScreenshot, GUTTER, SectionHeading, STEP, stagger } from '@/shared/ui/page'
import { DownloadSection } from '@/widgets/download/DownloadSection'

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

/** Post markup is plain HTML; these set it in the site's steps, full ink, a readable measure. */
const PROSE = [
  'max-w-[65ch] space-y-6 leading-[1.7] text-[var(--color-text-primary)]',
  '[&_h2]:pt-10 [&_h2]:text-[length:var(--step-lead)] [&_h2]:leading-tight [&_h2]:font-semibold',
  '[&_h3]:pt-6 [&_h3]:font-semibold',
  '[&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:opacity-70',
  '[&_ul]:list-disc [&_ul]:space-y-3 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-3 [&_ol]:pl-6',
  '[&_strong]:font-semibold',
  '[&_code]:rounded [&_code]:bg-[var(--color-bg-secondary)] [&_code]:px-1.5 [&_code]:py-0.5',
  '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[var(--color-bg-secondary)] [&_pre]:p-4'
].join(' ')

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function BackToBlog() {
  return (
    <Link
      to="/blog"
      className="font-medium text-[var(--color-text-primary)] underline underline-offset-4 transition-opacity hover:opacity-70"
      style={STEP.body}
    >
      Back to the blog
    </Link>
  )
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
      <section className={`${GUTTER} pt-20 pb-32 md:pt-32 md:pb-48`}>
        <h1
          data-reveal
          className="leading-none font-semibold tracking-[-0.035em] text-[var(--color-text-primary)]"
          style={STEP.heading}
        >
          Post not found
        </h1>
        <p className="mt-8 max-w-[48ch] text-[var(--color-text-primary)]" style={STEP.lead}>
          This post hasn&apos;t been published yet or doesn&apos;t exist.
        </p>
        <p className="mt-8">
          <BackToBlog />
        </p>
      </section>
    )
  }

  const related = posts
    .filter((p) => p.category === post.category && p.slug !== post.slug && postComponents[p.slug])
    .filter((p) => showDrafts || !p.draft)
    .slice(0, 3)

  const meta = [
    { label: 'Published', value: <time dateTime={post.date}>{formatDate(post.date)}</time> },
    post.updatedAt
      ? {
          label: 'Updated',
          value: <time dateTime={post.updatedAt}>{formatDate(post.updatedAt)}</time>
        }
      : null,
    { label: 'Reading time', value: post.readTime },
    { label: 'Category', value: categoryMeta[post.category].label },
    post.draft ? { label: 'Status', value: 'Draft' } : null
  ].filter((m) => m !== null)

  return (
    <>
      <article className={`${GUTTER} pt-20 pb-16 md:pt-32 md:pb-24`}>
        <div className="grid gap-12 lg:grid-cols-12">
          <h1
            data-reveal
            className="max-w-[22ch] leading-[1.02] font-semibold tracking-[-0.04em] text-[var(--color-text-primary)] lg:col-span-8 lg:col-start-4 lg:mb-8"
            style={{ fontSize: 'min(var(--step-heading), 6.5vw)' }}
          >
            {post.title}
          </h1>
          <aside className="lg:sticky lg:top-28 lg:col-span-3 lg:self-start">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-1" style={STEP.small}>
              {meta.map(({ label, value }, i) => (
                <div key={label} data-reveal style={stagger(i)}>
                  <dt className="text-[var(--color-text-secondary)]">{label}</dt>
                  <dd className="mt-1 font-medium text-[var(--color-text-primary)]">{value}</dd>
                </div>
              ))}
            </dl>
            <p data-reveal className="mt-8">
              <BackToBlog />
            </p>
          </aside>

          <div className="lg:col-span-9 lg:col-start-4" data-reveal>
            <AppScreenshot src={post.cover} alt="" />
          </div>

          <div
            data-reveal
            style={{ ...stagger(2), ...STEP.body }}
            className={`lg:col-span-7 lg:col-start-4 ${PROSE}`}
          >
            <Suspense fallback={null}>
              <Component />
            </Suspense>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className={`${GUTTER} py-16 md:py-24`}>
          <SectionHeading>Read next</SectionHeading>
          <div className="mt-12 md:mt-16">
            <ul className="space-y-12">
              {related.map((r, i) => (
                <li key={r.slug} data-reveal style={stagger(i)}>
                  <Link
                    to="/blog/$slug"
                    params={{ slug: r.slug }}
                    className="group grid items-center gap-6 md:grid-cols-12 md:gap-8"
                  >
                    <div className="md:col-span-4">
                      <AppScreenshot src={r.cover} alt="" />
                    </div>
                    <div className="md:col-span-7 md:col-start-6">
                      <h3
                        className="leading-tight font-semibold text-[var(--color-text-primary)] underline-offset-4 group-hover:underline"
                        style={STEP.lead}
                      >
                        {r.title}
                      </h3>
                      <p className="mt-3 text-[var(--color-text-secondary)]" style={STEP.small}>
                        {formatDate(r.date)} · {r.readTime}
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
