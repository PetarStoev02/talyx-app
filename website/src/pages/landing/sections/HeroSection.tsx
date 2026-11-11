import { ArrowRight } from 'lucide-react'
import { REPO_URL } from '../../../shared/data/release'
import { CTA_LABEL, MIN_MACOS } from '../../../shared/data/offer'
import { GUTTER, STEP, stagger } from '../../../shared/ui/page'
import { HeroFilm } from './HeroFilm'

export function HeroSection() {
  return (
    <section className={`${GUTTER} pt-16 pb-20 md:pt-24`}>
      <div className="grid gap-10 md:gap-14 lg:grid-cols-12 lg:items-end lg:gap-8">
        <h1
          className="lines leading-[0.98] font-semibold tracking-[-0.045em] text-[var(--color-text-primary)] lg:col-span-8"
          style={STEP.display}
        >
          <span className="line">
            <span data-line style={stagger(0)}>
              Your bots,
            </span>
          </span>
          <span className="line">
            <span data-line style={stagger(1)}>
              in one place.
            </span>
          </span>
        </h1>

        <div className="grid gap-8 md:grid-cols-12 lg:col-span-4 lg:grid-cols-1 lg:pb-[0.4em]">
          <p
            className="max-w-[44ch] leading-snug text-[var(--color-text-primary)] md:col-span-6 lg:col-span-1"
            style={STEP.lead}
          >
            Talyx is a free desktop app for your AI bots, on macOS and Linux. One roster, one chat,
            and a manager bot that hands out the work and briefs you.
          </p>
          <div className="flex flex-col items-start gap-4 md:col-span-6 md:items-end lg:col-span-1 lg:items-start">
            <a
              href="/#download"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--color-btn-primary-bg)] px-7 text-[17px] font-semibold text-[var(--color-btn-primary-text)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              {CTA_LABEL}
              <ArrowRight className="size-4" />
            </a>
            <p className="text-[14px] text-[var(--color-text-secondary)]">
              AGPL-3.0 licence. {MIN_MACOS} or newer, or Linux x64.{' '}
              <a
                href={REPO_URL}
                className="text-[var(--color-text-primary)] underline underline-offset-4"
              >
                Source on GitHub
              </a>
            </p>
          </div>
        </div>
      </div>

      <div data-reveal style={stagger(2)} className="mt-12 md:mt-16">
        <HeroFilm />
      </div>
    </section>
  )
}
