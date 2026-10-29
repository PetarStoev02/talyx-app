import { ArrowRight } from 'lucide-react'
import { APP_VERSION, DOWNLOADS } from '../../shared/data/release'
import { DMG_SIZE_MB, MIN_MACOS } from '../../shared/data/offer'

/** The close, in inverted colours: the hero's sentence answered. */
export function DownloadSection() {
  return (
    <section
      id="download"
      className="flex min-h-[90svh] flex-col justify-between gap-24 bg-[var(--color-text-primary)] px-5 py-24 text-[var(--color-bg)] sm:px-8 md:py-32"
    >
      <h2
        data-reveal
        className="leading-[0.92] font-semibold tracking-[-0.045em]"
        style={{ fontSize: 'var(--step-display)' }}
      >
        <span className="block">Your Mac,</span>
        <span className="block">your call.</span>
      </h2>

      <div className="grid items-end gap-10 md:grid-cols-12">
        <div data-reveal className="md:col-span-6" style={{ fontSize: 'var(--step-body)' }}>
          <p className="max-w-[40ch]" style={{ fontSize: 'var(--step-lead)' }}>
            Free and open source under MIT. No account, no trial, no card.
          </p>
          <p className="mt-4 max-w-[48ch] opacity-75">
            Not sure which Mac you have? Apple menu, About This Mac: it shows Chip (Apple Silicon)
            or Processor (Intel). Voice needs Apple Silicon.
          </p>
        </div>
        <div
          data-reveal
          style={{ '--i': 1 } as React.CSSProperties}
          className="flex flex-col items-stretch gap-3 md:col-span-5 md:col-start-8 md:items-end"
        >
          <a
            href={DOWNLOADS.appleSilicon}
            data-cta="download"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[var(--color-bg)] px-8 text-[17px] font-semibold text-[var(--color-text-primary)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            Download for Apple Silicon
            <ArrowRight className="size-4" />
          </a>
          <a
            href={DOWNLOADS.intel}
            data-cta="download-intel"
            className="inline-flex min-h-12 items-center justify-center px-2 text-[17px] font-medium underline underline-offset-4 transition-opacity hover:opacity-70"
          >
            Download for Intel
          </a>
          <p className="text-[14px] opacity-75">
            v{APP_VERSION} · {MIN_MACOS} or newer · {DMG_SIZE_MB} MB
          </p>
        </div>
      </div>
    </section>
  )
}
