import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { GitHubIcon, TalyxLogo } from '../../shared/ui/icons'
import { REPO_URL } from '../../shared/data/release'
import { CTA_LABEL } from '../../shared/data/offer'

/**
 * Logo and one action. Section links used to live here and sent people to
 * nine sub-pages instead of the download; the footer still carries the full
 * site map for anyone who wants it.
 */
export function Header() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 bg-[var(--color-header-bg)] backdrop-blur-md transition-[border-color] duration-200 ${
        scrolled ? 'border-b border-[var(--color-border)]' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 text-[var(--color-text-primary)]">
          <TalyxLogo />
          <span className="text-[15px] font-semibold tracking-tight">Talyx</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={REPO_URL}
            aria-label="Talyx on GitHub"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            <GitHubIcon className="size-5" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <a
            href="/#download"
            data-cta="download-header"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-btn-primary-bg)] px-4 py-1.5 text-sm font-medium text-[var(--color-btn-primary-text)] transition-all hover:shadow-[0_2px_12px_var(--color-btn-primary-hover-shadow)]"
          >
            <span className="sm:hidden">Download free</span>
            <span className="hidden sm:inline">{CTA_LABEL}</span>
            <ArrowRight className="size-3.5" />
          </a>
        </div>
      </div>
    </header>
  )
}
