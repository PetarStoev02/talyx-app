import { ArrowRight } from 'lucide-react'
import { CTA_LABEL, CTA_SUBLINE } from '../../../shared/data/offer'

/** The page's only call to action, repeated after each proof block. */
export function DownloadCta({ size = 'default' }: { size?: 'default' | 'large' }) {
  const large = size === 'large'

  return (
    <div className="flex flex-col items-center">
      <a
        href="/#download"
        data-cta="download"
        className={`inline-flex items-center gap-2 rounded-full bg-[var(--color-btn-primary-bg)] font-semibold text-[var(--color-btn-primary-text)] transition-all hover:-translate-y-px hover:shadow-[0_4px_20px_var(--color-btn-primary-hover-shadow)] ${
          large ? 'px-8 py-4 text-[17px]' : 'px-7 py-3 text-[15px]'
        }`}
      >
        {CTA_LABEL}
        <ArrowRight className="size-4" />
      </a>
      <p className="mt-3 text-[13px] text-[var(--color-text-tertiary)]">{CTA_SUBLINE}</p>
    </div>
  )
}

/** The repeated CTA between proof blocks. */
export function CtaBreak() {
  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-24">
      <DownloadCta />
    </section>
  )
}
