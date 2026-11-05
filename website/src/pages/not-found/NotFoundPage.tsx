import { Link } from '@tanstack/react-router'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useNoIndex } from '@/shared/hooks/useNoIndex'
import { AppScreenshot, GUTTER, STEP, stagger } from '@/shared/ui/page'

const ELSEWHERE = [
  { to: '/roadmap', label: 'See the roadmap' },
  { to: '/contact', label: 'Get in touch' }
] as const

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  useNoIndex()

  return (
    <section
      className={`${GUTTER} grid flex-1 items-center gap-16 pt-20 pb-32 md:pt-32 md:pb-48 lg:grid-cols-12 lg:gap-x-8`}
    >
      <div className="lg:col-span-6">
        <h1
          className="leading-[0.98] font-semibold tracking-[-0.045em] text-[var(--color-text-primary)]"
          style={STEP.display}
        >
          <span data-reveal className="block">
            Page
          </span>
          <span data-reveal className="block" style={stagger(1)}>
            not found
          </span>
        </h1>
        <p
          data-reveal
          className="mt-10 max-w-[36ch] text-[var(--color-text-primary)]"
          style={{ ...stagger(2), ...STEP.lead }}
        >
          The link may be old, or the address mistyped.
        </p>
        <Link
          to="/"
          data-reveal
          style={stagger(3)}
          className="mt-10 inline-flex min-h-12 items-center rounded-full bg-[var(--color-btn-primary-bg)] px-7 text-[17px] font-semibold text-[var(--color-btn-primary-text)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
        >
          Go to the home page
        </Link>
        <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3" style={STEP.body}>
          {ELSEWHERE.map(({ to, label }, i) => (
            <li key={to} data-reveal style={stagger(i + 4)}>
              <Link
                to={to}
                className="font-medium text-[var(--color-text-primary)] underline underline-offset-4 transition-opacity hover:opacity-70"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div data-reveal style={stagger(2)} className="lg:col-span-6">
        <AppScreenshot src="/previews/chat.jpg" alt="Talyx: the roster and a chat with Talyx" />
      </div>
    </section>
  )
}
