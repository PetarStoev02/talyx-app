import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { GitHubIcon, TalyxLogo } from '../../shared/ui/icons'
import { REPO_URL } from '../../shared/data/release'
import { CTA_LABEL } from '../../shared/data/offer'
import { features, resources, useCases } from '../../shared/data/navigation'
import { ProductPanel, ResourcesPanel, UseCasesPanel } from './MegaPanels'

const MENUS = [
  { id: 'product', label: 'Product', Panel: ProductPanel },
  { id: 'use-cases', label: 'Use cases', Panel: UseCasesPanel },
  { id: 'resources', label: 'Resources', Panel: ResourcesPanel }
] as const

type MenuId = (typeof MENUS)[number]['id']

/** Hover opens after a beat so passing the cursor across the bar does not flash panels. */
const OPEN_DELAY_MS = 90
const CLOSE_DELAY_MS = 220

/** Wordmark, three menus with previews, one action. */
export function Header() {
  const [open, setOpen] = useState<MenuId | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const { pathname } = useLocation()

  useEffect(() => {
    setOpen(null)
    setSheetOpen(false)
  }, [pathname])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setOpen(null)
      setSheetOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function schedule(next: MenuId | null, delay: number) {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(next), delay)
  }

  const active = MENUS.find((menu) => menu.id === open)

  return (
    <header
      className="sticky top-0 z-50 bg-[var(--color-bg)]"
      onMouseLeave={() => schedule(null, CLOSE_DELAY_MS)}
      onMouseEnter={() => window.clearTimeout(timer.current)}
    >
      <div className="flex h-16 items-center justify-between gap-6 px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5 text-[var(--color-text-primary)]">
          <TalyxLogo />
          <span className="text-[17px] font-semibold tracking-tight">Talyx</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {MENUS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-expanded={open === id}
              aria-controls={`menu-${id}`}
              onClick={() => setOpen(open === id ? null : id)}
              onMouseEnter={() => schedule(id, open ? 0 : OPEN_DELAY_MS)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium text-[var(--color-text-primary)] transition-colors aria-expanded:bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]"
            >
              {label}
              <ChevronDown
                aria-hidden="true"
                className={`size-4 transition-transform duration-200 ${open === id ? 'rotate-180' : ''}`}
              />
            </button>
          ))}
          <a
            href="/#faq"
            className="inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <a
            href={REPO_URL}
            aria-label="Talyx on GitHub"
            className="inline-flex min-h-11 items-center gap-1.5 px-2 text-[15px] font-medium text-[var(--color-text-primary)] transition-opacity hover:opacity-60"
          >
            <GitHubIcon className="size-5" />
            <span className="hidden xl:inline">GitHub</span>
          </a>
          <a
            href="/#download"
            data-cta="download-header"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--color-btn-primary-bg)] px-4 text-[15px] font-medium text-[var(--color-btn-primary-text)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="sm:hidden">Download</span>
            <span className="hidden sm:inline">{CTA_LABEL}</span>
            <ArrowRight className="size-3.5" />
          </a>
          <button
            type="button"
            aria-expanded={sheetOpen}
            aria-controls="menu-sheet"
            onClick={() => setSheetOpen(!sheetOpen)}
            className="inline-flex min-h-11 items-center px-2 text-[15px] font-medium text-[var(--color-text-primary)] lg:hidden"
          >
            {sheetOpen ? 'Close' : 'Menu'}
          </button>
        </div>
      </div>

      {active ? (
        <>
          <div
            aria-hidden="true"
            onClick={() => setOpen(null)}
            className="fixed inset-x-0 top-16 bottom-0 -z-10 hidden bg-black/25 lg:block"
          />
          <div
            id={`menu-${active.id}`}
            role="region"
            aria-label={active.label}
            className="menu-drop hidden bg-[var(--color-bg)] px-5 pt-6 pb-10 sm:px-8 lg:block"
          >
            <active.Panel />
          </div>
        </>
      ) : null}

      {sheetOpen ? <MenuSheet /> : null}
    </header>
  )
}

/** The phone's menu: every page, grouped, no previews. */
function MenuSheet() {
  const groups = [
    {
      title: 'Product',
      links: features.map((f) => ({
        key: f.slug,
        label: f.title,
        to: '/features/$slug',
        slug: f.slug
      }))
    },
    {
      title: 'Use cases',
      links: useCases.map((u) => ({
        key: u.slug,
        label: u.title,
        to: '/use-cases/$slug',
        slug: u.slug
      }))
    }
  ] as const

  return (
    <nav
      id="menu-sheet"
      aria-label="Main"
      className="menu-drop fixed inset-x-0 top-16 bottom-0 overflow-y-auto bg-[var(--color-bg)] px-5 pt-4 pb-16 sm:px-8 lg:hidden"
    >
      {groups.map(({ title, links }) => (
        <section key={title} className="mt-8 first:mt-0">
          <h2 className="text-[15px] font-semibold text-[var(--color-text-secondary)]">{title}</h2>
          <ul className="mt-3 space-y-1">
            {links.map(({ key, label, to, slug }) => (
              <li key={key}>
                <Link
                  to={to}
                  params={{ slug }}
                  className="block py-2 text-[24px] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="mt-8">
        <h2 className="text-[15px] font-semibold text-[var(--color-text-secondary)]">Resources</h2>
        <ul className="mt-3 space-y-1">
          {resources.map(({ to, title }) => (
            <li key={to}>
              <Link
                to={to}
                className="block py-2 text-[24px] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]"
              >
                {title}
              </Link>
            </li>
          ))}
          <li>
            <a
              href="/#faq"
              className="block py-2 text-[24px] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]"
            >
              FAQ
            </a>
          </li>
        </ul>
      </section>
    </nav>
  )
}
