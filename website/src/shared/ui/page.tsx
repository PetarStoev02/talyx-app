/**
 * The building blocks every inner page is set in, so they share the landing
 * page's margins, five type steps and full-ink text.
 */

/** Outer margins used by every section. */
export const GUTTER = 'px-5 sm:px-8'

/** The type steps as inline styles; spread one when the style needs more keys. */
export const STEP = {
  display: { fontSize: 'var(--step-display)' },
  heading: { fontSize: 'var(--step-heading)' },
  lead: { fontSize: 'var(--step-lead)' },
  body: { fontSize: 'var(--step-body)' },
  small: { fontSize: 'var(--step-small)' }
} as const

/** Delays a `[data-reveal]` element's entrance by `i` beats, so siblings arrive in order. */
export function stagger(i: number): React.CSSProperties {
  return { '--i': i } as React.CSSProperties
}

/** The page's title and one sentence saying what it is. Titles must fit two lines. */
export function PageHero({
  title,
  lead,
  children
}: {
  title: string
  lead: string
  children?: React.ReactNode
}) {
  return (
    <section className={`${GUTTER} pt-20 pb-16 md:pt-32 md:pb-24`}>
      <h1
        data-reveal
        className="max-w-[16ch] leading-[0.98] font-semibold tracking-[-0.045em] text-[var(--color-text-primary)]"
        style={STEP.display}
      >
        {title}
      </h1>
      <div className="mt-10 grid gap-10 md:mt-14 md:grid-cols-12">
        <p
          data-reveal
          className="max-w-[44ch] leading-snug text-[var(--color-text-primary)] md:col-span-6"
          style={{ ...STEP.lead, ...stagger(1) }}
        >
          {lead}
        </p>
        {children ? (
          <div data-reveal className="md:col-span-6" style={stagger(2)}>
            {children}
          </div>
        ) : null}
      </div>
    </section>
  )
}

/** A section heading at the page's second size. `className` is for layout only. */
export function SectionHeading({
  children,
  id,
  className = ''
}: {
  children: React.ReactNode
  id?: string
  className?: string
}) {
  return (
    <h2
      id={id}
      data-reveal
      className={`leading-none font-semibold tracking-[-0.035em] text-[var(--color-text-primary)] ${className}`}
      style={STEP.heading}
    >
      {children}
    </h2>
  )
}

/** Running text: full ink, body size, a readable measure. */
export function Body({
  children,
  className = ''
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={`max-w-[60ch] leading-relaxed text-[var(--color-text-primary)] ${className}`}
      style={STEP.body}
    >
      {children}
    </p>
  )
}

/** A short subheading inside a section, at the lead size. */
export function ItemTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="leading-tight font-semibold text-[var(--color-text-primary)]" style={STEP.lead}>
      {children}
    </h3>
  )
}

/**
 * The Mac wallpaper, filling its `relative isolate` parent behind everything
 * else in it. `objectPosition` picks which part of the picture shows.
 */
export function Wallpaper({
  className = '',
  objectPosition,
  loading
}: {
  className?: string
  objectPosition?: string
  loading?: 'lazy' | 'eager'
}) {
  return (
    <img
      src="/hero-wallpaper.jpg"
      alt=""
      width={2200}
      height={1238}
      loading={loading}
      className={`absolute inset-0 -z-10 size-full object-cover ${className}`}
      style={objectPosition ? { objectPosition } : undefined}
    />
  )
}

/** A screenshot of the real app on the Mac wallpaper, the way the landing page shows it. */
export function AppScreenshot({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="relative isolate overflow-hidden rounded-2xl p-4 md:p-8">
      <Wallpaper loading="lazy" />
      <img
        src={src}
        alt={alt}
        width={1100}
        height={720}
        loading="lazy"
        className="w-full rounded-xl"
      />
    </figure>
  )
}
