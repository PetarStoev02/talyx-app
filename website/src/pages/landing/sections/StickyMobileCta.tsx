import { CTA_LABEL, CTA_SUBLINE } from '../../../shared/data/offer'

/**
 * Mobile-only bar pinned to the bottom. The hero CTA is already above the
 * fold, so this exists purely to keep the same single action reachable further
 * down the page.
 */
export function StickyMobileCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-header-bg)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:hidden">
      <a
        href="/#download"
        data-cta="download-sticky"
        className="flex w-full items-center justify-center rounded-full bg-[var(--color-btn-primary-bg)] px-5 py-3 text-[15px] font-semibold text-[var(--color-btn-primary-text)]"
      >
        {CTA_LABEL}
      </a>
      <p className="mt-1.5 text-center text-[12px] text-[var(--color-text-tertiary)]">
        {CTA_SUBLINE}
      </p>
    </div>
  )
}
