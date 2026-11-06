import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { GitHubIcon, TalyxLogo } from '../../shared/ui/icons'
import { GUTTER } from '../../shared/ui/page'
import { NavAnchor } from '../../shared/ui/NavAnchor'
import { REPO_URL } from '../../shared/data/release'
import { CTA_LABEL } from '../../shared/data/offer'
import {
  DOWNLOAD_GROUP,
  PRODUCT_GROUP,
  RESOURCES_GROUP,
  type NavGroup
} from '../../shared/data/navigation'
import { ProductPanel, ResourcesPanel } from './MegaPanels'

const MENUS = [
  { id: 'product', label: 'Product', Panel: ProductPanel },
  { id: 'resources', label: 'Resources', Panel: ResourcesPanel }
] as const

type MenuId = (typeof MENUS)[number]['id']

/** Hover opens after a beat so passing the cursor across the bar does not flash panels. */
const OPEN_DELAY_MS = 90
const CLOSE_DELAY_MS = 220

const FAQ_HREF = '/#faq'

/** Wordmark, two menus with previews, one action. */
export function Header() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  const menu = useHoverMenu(closeSheet)

  return (
    <header
      className="sticky top-0 z-50 bg-[var(--color-bg)]"
      onMouseLeave={() => menu.scheduleMenu(null, CLOSE_DELAY_MS)}
      onMouseEnter={menu.cancelScheduledMenu}
    >
      <div className={`flex h-16 items-center justify-between gap-6 ${GUTTER}`}>
        <Link to="/" className="flex items-center gap-2.5 text-[var(--color-text-primary)]">
          <TalyxLogo />
          <span className="text-[17px] font-semibold tracking-tight">Talyx</span>
        </Link>
        <DesktopNav menu={menu} />
        <HeaderActions sheetOpen={sheetOpen} onToggleSheet={() => setSheetOpen(!sheetOpen)} />
      </div>

      {sheetOpen ? <MenuSheet /> : null}
    </header>
  )
}

/**
 * Which mega menu is open, opened and closed on a hover delay. Escape and a
 * route change close it and call `onDismiss`, which must be stable. A click on
 * a trigger (or Enter on it) toggles its menu, except that the first one after a
 * hover-open keeps the menu open: the pointer reaches the trigger before it
 * clicks, so the hover has already opened that menu.
 */
function useHoverMenu(onDismiss: () => void) {
  const [openMenuId, setOpenMenuId] = useState<MenuId | null>(null)
  const hoverTimer = useRef<number | undefined>(undefined)
  const openedByHover = useRef(false)
  const { pathname } = useLocation()

  useEffect(() => {
    setOpenMenuId(null)
    onDismiss()
  }, [pathname, onDismiss])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setOpenMenuId(null)
      onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])

  function scheduleMenu(next: MenuId | null, delay: number) {
    window.clearTimeout(hoverTimer.current)
    if (next === openMenuId) return
    hoverTimer.current = window.setTimeout(() => {
      openedByHover.current = next !== null
      setOpenMenuId(next)
    }, delay)
  }

  function toggleMenu(id: MenuId) {
    window.clearTimeout(hoverTimer.current)
    const close = openMenuId === id && !openedByHover.current
    openedByHover.current = false
    setOpenMenuId(close ? null : id)
  }

  function cancelScheduledMenu() {
    window.clearTimeout(hoverTimer.current)
  }

  return { openMenuId, setOpenMenuId, scheduleMenu, cancelScheduledMenu, toggleMenu }
}

function DesktopNav({ menu }: { menu: ReturnType<typeof useHoverMenu> }) {
  const { openMenuId, setOpenMenuId, scheduleMenu, toggleMenu } = menu

  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      {MENUS.map(({ id, label, Panel }) => (
        <Fragment key={id}>
          <button
            type="button"
            aria-expanded={openMenuId === id}
            aria-controls={`menu-${id}`}
            onClick={() => toggleMenu(id)}
            onMouseEnter={() => scheduleMenu(id, openMenuId ? 0 : OPEN_DELAY_MS)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium text-[var(--color-text-primary)] transition-colors aria-expanded:bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)]"
          >
            {label}
            <ChevronDown
              aria-hidden="true"
              className={`size-4 transition-transform duration-200 ${openMenuId === id ? 'rotate-180' : ''}`}
            />
          </button>
          {/* Right after its button, so Tab goes from the button into the panel. */}
          {openMenuId === id ? (
            <>
              <div
                aria-hidden="true"
                onClick={() => setOpenMenuId(null)}
                className="fixed inset-x-0 top-16 bottom-0 -z-10 bg-black/25"
              />
              <div
                id={`menu-${id}`}
                role="region"
                aria-label={label}
                className={`menu-drop absolute inset-x-0 top-full bg-[var(--color-bg)] pt-6 pb-10 ${GUTTER}`}
              >
                <Panel />
              </div>
            </>
          ) : null}
        </Fragment>
      ))}
      <a
        href={FAQ_HREF}
        className="inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
      >
        FAQ
      </a>
    </nav>
  )
}

function HeaderActions({
  sheetOpen,
  onToggleSheet
}: {
  sheetOpen: boolean
  onToggleSheet: () => void
}) {
  return (
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
        onClick={onToggleSheet}
        className="inline-flex min-h-11 items-center px-2 text-[15px] font-medium text-[var(--color-text-primary)] lg:hidden"
      >
        {sheetOpen ? 'Close' : 'Menu'}
      </button>
    </div>
  )
}

const SHEET_GROUPS: NavGroup[] = [
  PRODUCT_GROUP,
  { ...RESOURCES_GROUP, links: [...RESOURCES_GROUP.links, { label: 'FAQ', href: FAQ_HREF }] },
  DOWNLOAD_GROUP
]

const SHEET_LINK =
  'block py-2 text-[24px] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]'

/** The phone's menu: every page, grouped, no previews. */
function MenuSheet() {
  return (
    <nav
      id="menu-sheet"
      aria-label="Main"
      className={`menu-drop fixed inset-x-0 top-16 bottom-0 overflow-y-auto bg-[var(--color-bg)] pt-4 pb-16 ${GUTTER} lg:hidden`}
    >
      {SHEET_GROUPS.map(({ title, links }) => (
        <section key={title} className="mt-8 first:mt-0">
          <h2 className="text-[15px] font-semibold text-[var(--color-text-secondary)]">{title}</h2>
          <ul className="mt-3 space-y-1">
            {links.map((link) => (
              <li key={link.label}>
                <NavAnchor link={link} className={SHEET_LINK} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  )
}
