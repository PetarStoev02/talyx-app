import { Bug, ShieldAlert } from 'lucide-react'
import { ISSUES_URL, SECURITY_REPORT_URL } from '../../shared/data/release'

const cards = [
  {
    icon: Bug,
    title: 'Bugs and ideas',
    description: 'Open an issue on GitHub; issues are public.',
    cta: 'Open an issue',
    href: ISSUES_URL
  },
  {
    icon: ShieldAlert,
    title: 'Security problems',
    description: 'Report privately on GitHub.',
    cta: 'Report a vulnerability',
    href: SECURITY_REPORT_URL
  }
]

export function ContactPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <section className="px-4 pt-16 pb-8 text-center sm:px-6 sm:pt-24 sm:pb-12">
        <div className="mx-auto max-w-[700px]">
          <h1 className="text-[40px] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--color-text-primary)] sm:text-[56px]">
            Contact
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-[var(--color-text-secondary)] sm:text-xl">
            Talyx is open source, and everything happens on GitHub.
          </p>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="mx-auto grid max-w-[700px] gap-4 sm:grid-cols-2">
          {cards.map(({ icon: Icon, title, description, cta, href }) => (
            <a
              key={title}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 transition-colors hover:bg-[var(--color-surface-hover)]"
            >
              <Icon className="size-6 text-[var(--color-text-primary)]" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
              <span className="mt-auto text-sm font-medium text-[var(--color-text-primary)] underline underline-offset-4">
                {cta}
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
