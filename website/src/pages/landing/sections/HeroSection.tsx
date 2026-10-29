import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { REPO_URL } from '../../../shared/data/release'
import { CTA_LABEL, MIN_MACOS } from '../../../shared/data/offer'

const CARDS = [
  { ask: 'Add “Dentist” to Calendar', detail: 'Tomorrow, 16:00' },
  { ask: 'Sort 47 files in Downloads', detail: 'Into 6 folders' },
  { ask: 'Reply to Maya in Mail', detail: '“Thursday works.”' }
]
const CARD_MS = 3200

/**
 * The approval card sits inside the sentence where "what" would be shown
 * rather than said: you tell it, it asks first.
 */
function CardStrip({ className }: { className: string }) {
  const [index, setIndex] = useState(0)
  const card = CARDS[index]

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % CARDS.length), CARD_MS)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <span
      aria-hidden="true"
      className={`relative isolate items-center justify-center overflow-hidden rounded-[0.12em] ${className}`}
    >
      <img
        src="/hero-wallpaper.jpg"
        alt=""
        width={1600}
        height={1000}
        className="drift absolute inset-0 -z-10 size-full object-cover"
      />
      <span
        key={index}
        data-ui
        className="card-swap flex items-center gap-4 rounded-xl bg-white px-4 py-3 text-[15px] leading-tight font-medium tracking-normal text-[#171717]"
      >
        {/* Drawn from attributes so the card's words stay out of the headline's text. */}
        <span className="flex flex-col">
          <span data-text={card.ask} className="before:content-[attr(data-text)]" />
          <span
            data-text={card.detail}
            className="mt-1 text-[13px] font-normal text-[#666] before:content-[attr(data-text)]"
          />
        </span>
        <span
          data-text="Approve ↵"
          className="rounded-md bg-black px-3 py-1.5 text-[13px] text-white before:content-[attr(data-text)]"
        />
      </span>
    </span>
  )
}

export function HeroSection() {
  return (
    <section className="flex flex-col justify-center px-5 pt-16 pb-20 sm:px-8 md:pt-24 lg:min-h-[calc(100svh-4rem)]">
      <h1
        className="lines leading-[0.98] font-semibold tracking-[-0.045em] text-[var(--color-text-primary)]"
        style={{ fontSize: 'var(--step-display)' }}
      >
        <span className="line">
          <span data-line style={{ '--i': 0 } as React.CSSProperties}>
            Tell your Mac
          </span>
        </span>
        <span className="line">
          <span
            data-line
            className="flex items-center gap-[0.22em]"
            style={{ '--i': 1, display: 'flex' } as React.CSSProperties}
          >
            <CardStrip className="hidden h-[0.82em] flex-1 lg:flex" />
            what to do.
          </span>
        </span>
      </h1>

      <CardStrip className="mt-8 flex aspect-[2/1] w-full md:aspect-[3/1] lg:hidden" />

      <div className="mt-10 grid gap-8 md:mt-14 md:grid-cols-12">
        <p
          className="max-w-[44ch] leading-snug text-[var(--color-text-primary)] md:col-span-6"
          style={{ fontSize: 'var(--step-lead)' }}
        >
          Talyx is a free Mac assistant. Press ⌘⇧Space, ask in your own words, and your own Claude
          does it once you approve the card.
        </p>
        <div className="flex flex-col items-start gap-4 md:col-span-6 md:items-end">
          <a
            href="/#download"
            data-cta="download"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--color-btn-primary-bg)] px-7 text-[17px] font-semibold text-[var(--color-btn-primary-text)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            {CTA_LABEL}
            <ArrowRight className="size-4" />
          </a>
          <p className="text-[14px] text-[var(--color-text-secondary)]">
            MIT licence, {MIN_MACOS} or newer.{' '}
            <a
              href={REPO_URL}
              className="text-[var(--color-text-primary)] underline underline-offset-4"
            >
              Source on GitHub
            </a>
            {' · '}
            <Link
              to="/blog/$slug"
              params={{ slug: 'talyx-is-now-free-and-open-source' }}
              className="text-[var(--color-text-primary)] underline underline-offset-4"
            >
              Why it is free
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
