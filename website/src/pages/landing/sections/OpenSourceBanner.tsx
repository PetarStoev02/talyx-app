import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

export function OpenSourceBanner() {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: 'talyx-is-now-free-and-open-source' }}
      className="group flex items-center justify-center gap-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
    >
      Talyx is now free and open source
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
