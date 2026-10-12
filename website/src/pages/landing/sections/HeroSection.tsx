import { ArrowRight } from 'lucide-react'
import { REPO_URL } from '../../../shared/data/release'
import { CTA_LABEL, CTA_SUBLINE } from '../../../shared/data/offer'
import { AppWindow } from '../../../features/app-demo/AppWindow'

/**
 * Headline and CTA on the page background, then the real Assistant window
 * resting on the desktop wallpaper it actually runs on.
 */
export function HeroSection() {
  return (
    <section className="overflow-hidden pt-16 pb-16 sm:pt-24 sm:pb-24">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <h1 className="max-w-[620px] text-[38px] leading-[1.05] font-semibold tracking-[-0.03em] text-[var(--color-text-primary)] sm:text-[52px]">
          Tell your Mac what to do.
        </h1>
        <p className="mt-5 max-w-[540px] text-[16px] leading-relaxed text-[var(--color-text-secondary)] sm:text-[18px]">
          Press ⌘⇧Space and ask in your own words. Your own Claude plans it, shows you a card, and
          asks before it changes anything — files, calendar, mail, and the screen itself when
          nothing else fits.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="/#download"
            data-cta="download"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-btn-primary-bg)] px-6 py-3 text-[15px] font-semibold text-[var(--color-btn-primary-text)] transition-all hover:-translate-y-px hover:shadow-[0_4px_20px_var(--color-btn-primary-hover-shadow)]"
          >
            {CTA_LABEL}
            <ArrowRight className="size-4" />
          </a>
          <a
            href={REPO_URL}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-btn-secondary-border)] bg-[var(--color-btn-secondary-bg)] px-6 py-3 text-[15px] font-semibold text-[var(--color-btn-secondary-text)] transition-all hover:border-[var(--color-btn-secondary-hover-border)] hover:shadow-[0_4px_20px_var(--color-btn-secondary-hover-shadow)]"
          >
            View on GitHub
          </a>
          <span className="text-[13px] text-[var(--color-text-tertiary)]">{CTA_SUBLINE}</span>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-[1200px] px-4 sm:mt-16 sm:px-6">
        {/* The demo is clickable, so the window is shown whole rather than
            cropped — the approval card is the part worth seeing. */}
        <div
          className="rounded-2xl bg-cover bg-center p-[4%] sm:p-[5%]"
          style={{ backgroundImage: "url('/hero-wallpaper.jpg')" }}
        >
          <AppWindow />
        </div>
      </div>
    </section>
  )
}
