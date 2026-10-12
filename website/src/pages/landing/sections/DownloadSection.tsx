import { ArrowRight } from 'lucide-react'
import { InstallSteps } from './InstallSteps'
import { APP_VERSION, DOWNLOADS, REPO_URL } from '../../../shared/data/release'
import { DMG_SIZE_MB, MIN_MACOS } from '../../../shared/data/offer'

export function DownloadSection() {
  return (
    <section
      id="download"
      className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="mx-auto max-w-[640px] text-center">
        <h2 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[40px]">
          Free and open source.
        </h2>
        <p className="mt-3 text-[15px] text-[var(--color-text-secondary)]">
          MIT licensed. No account, no trial, no card. macOS only.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={DOWNLOADS.appleSilicon}
            data-cta="download"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-btn-primary-bg)] px-8 py-4 text-[17px] font-semibold text-[var(--color-btn-primary-text)] transition-all hover:-translate-y-px hover:shadow-[0_4px_20px_var(--color-btn-primary-hover-shadow)]"
          >
            Download for Mac (Apple Silicon)
            <ArrowRight className="size-4" />
          </a>
          <a
            href={DOWNLOADS.intel}
            data-cta="download-intel"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-btn-secondary-border)] bg-[var(--color-btn-secondary-bg)] px-8 py-4 text-[17px] font-semibold text-[var(--color-btn-secondary-text)] transition-all hover:border-[var(--color-btn-secondary-hover-border)] hover:shadow-[0_4px_20px_var(--color-btn-secondary-hover-shadow)]"
          >
            Download for Intel Mac
          </a>
        </div>
        <p className="mt-4 text-[13px] text-[var(--color-text-tertiary)]">
          Not sure which? Apple menu → About This Mac shows Chip (Apple Silicon) or Processor
          (Intel). Voice needs Apple Silicon.
        </p>
        <div className="mt-4 flex items-center justify-center gap-5 text-[14px] font-medium">
          <a
            href={REPO_URL}
            className="text-[var(--color-text-secondary)] underline-offset-4 hover:text-[var(--color-text-primary)] hover:underline"
          >
            View the source on GitHub
          </a>
          <a
            href={`${REPO_URL}#development`}
            className="text-[var(--color-text-secondary)] underline-offset-4 hover:text-[var(--color-text-primary)] hover:underline"
          >
            Build it yourself
          </a>
        </div>

        <InstallSteps />

        <p className="mt-8 text-[13px] text-[var(--color-text-tertiary)]">
          v{APP_VERSION} · {MIN_MACOS}+ · {DMG_SIZE_MB} MB
        </p>
      </div>
    </section>
  )
}
