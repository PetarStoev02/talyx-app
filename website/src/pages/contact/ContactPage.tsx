import { ISSUES_URL, SECURITY_REPORT_URL } from '../../shared/data/release'
import { GUTTER, PageHero, STEP, stagger } from '../../shared/ui/page'

const CHANNELS = [
  {
    title: 'Bugs and ideas',
    description: 'Open an issue on GitHub; issues are public.',
    cta: 'Open an issue',
    href: ISSUES_URL
  },
  {
    title: 'Security problems',
    description: 'Report privately on GitHub.',
    cta: 'Report a vulnerability',
    href: SECURITY_REPORT_URL
  }
]

export function ContactPage() {
  return (
    <>
      <PageHero title="Contact" lead="Talyx is open source, and everything happens on GitHub." />

      <section className={`${GUTTER} grid gap-24 pt-8 pb-32 md:grid-cols-12 md:gap-10 md:pb-48`}>
        {CHANNELS.map(({ title, description, cta, href }, i) => (
          <div key={title} className="md:col-span-6">
            <h2
              data-reveal
              className="max-w-[12ch] leading-none font-semibold tracking-[-0.035em] text-[var(--color-text-primary)]"
              style={{ ...stagger(i), ...STEP.heading }}
            >
              {title}
            </h2>
            <p
              data-reveal
              className="mt-8 max-w-[36ch] text-[var(--color-text-primary)]"
              style={{ ...stagger(i + 1), ...STEP.lead }}
            >
              {description}
            </p>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              data-reveal
              className="mt-6 inline-flex min-h-11 items-center font-semibold text-[var(--color-text-primary)] underline underline-offset-4 transition-opacity hover:opacity-70"
              style={{ ...stagger(i + 2), ...STEP.lead }}
            >
              {cta}
            </a>
          </div>
        ))}
      </section>
    </>
  )
}
