import { useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useLanguage } from '@shared/lib/i18n'
import { useNavigation } from '@features/modules/store'
import type { DockSection } from '@features/modules/sections'
import { IconButton } from '@shared/ui/IconButton'
import { TalyxLogo } from '@shared/ui/TalyxLogo'
import { cn } from '@shared/lib/utils'
import { ModuleBackgrounds } from './ModuleBackground'
import { PageGlyph } from './PageGlyph'
import { ViewToggles } from './SidebarFooter'
import { RAIL_MARK } from './pageMarks'
import { UpdateButton } from './UpdateButton'
import { glyphOf, mod, type SidebarNav, useSidebarNav, viewOf } from './useSidebarNav'
import { LAYERED_RAIL_PX, dragRegion, noDragRegion } from './windowChrome'

// Below this window width the panel starts folded: rail, panel and a usable chat need about 900px.
const FOLD_BELOW_PX = 900

export interface LayeredParts {
  width: number
  content: React.ReactNode
  titleEnd: React.ReactNode
  footerEnd: React.ReactNode
  resizer: React.ReactNode
}

function subscribeResize(onResize: () => void): () => void {
  window.addEventListener('resize', onResize)
  return () => window.removeEventListener('resize', onResize)
}

/**
 * The Layered layout's navigation: a rail of pages on the ground (Settings, Usage and refresh at
 * its foot) beside the open page's panel on the tone step, which can fold away.
 */
export function LayeredSidebar(parts: LayeredParts): React.JSX.Element {
  return <LayeredNav nav={useSidebarNav()} {...parts} />
}

/** LayeredSidebar with its pages given, so each case can be drawn on its own. */
export function LayeredNav({
  nav,
  width,
  content,
  titleEnd,
  footerEnd,
  resizer
}: LayeredParts & { nav: SidebarNav }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const currentView = useNavigation((s) => s.currentView)
  const narrow = useSyncExternalStore(subscribeResize, () => window.innerWidth < FOLD_BELOW_PX)
  // The user's last fold or unfold; null follows the window: folded while it is narrow.
  const [choice, setChoice] = useState<boolean | null>(null)
  const [seen, setSeen] = useState({ view: currentView, narrow })
  if (seen.view !== currentView || seen.narrow !== narrow) {
    setSeen({ view: currentView, narrow })
    // Opening a page shows its panel, unless the window is too narrow to fit it beside the page;
    // crossing the width hands the fold back to the window.
    setChoice(seen.view !== currentView && !narrow ? true : null)
  }
  const open = choice ?? !narrow
  const foldRef = useRef<HTMLButtonElement>(null)
  const unfoldRef = useRef<HTMLButtonElement>(null)

  // The button that took focus disappears, so focus moves to its counterpart.
  function fold(next: boolean): void {
    flushSync(() => setChoice(next))
    ;(next ? foldRef : unfoldRef).current?.focus()
  }

  return (
    <aside
      className="relative flex h-full shrink-0"
      style={{ width: open ? LAYERED_RAIL_PX + width : LAYERED_RAIL_PX }}
    >
      <div
        className="flex shrink-0 flex-col items-center bg-background pb-3"
        style={{ width: LAYERED_RAIL_PX, '--rail': `${LAYERED_RAIL_PX}px` } as React.CSSProperties}
      >
        <div className="mb-2 h-14 w-full shrink-0" style={dragRegion} />
        {/* Many modules in a short window scroll here, so Settings and Usage stay in reach; the fade
            shows more past the edge. Full width and padded, so the open page's bar and the focus
            ring are not clipped by the scroll box. */}
        <nav
          aria-label={t('nav.sections')}
          className="flex min-h-0 w-full scroll-fade flex-col items-center gap-1 overflow-y-auto overscroll-contain py-1 [scrollbar-width:none]"
        >
          {nav.pages.map((page, i) => (
            <RailPage key={page.key} page={page} index={i} />
          ))}
        </nav>
        <div className="mt-auto flex shrink-0 flex-col items-center gap-1 pt-2">
          {!open && (
            <IconButton
              ref={unfoldRef}
              label={t('sidebar.expand')}
              side="right"
              onClick={() => fold(true)}
            >
              <PanelLeftOpen />
            </IconButton>
          )}
          <ViewToggles className="flex flex-col items-center gap-1" mark={RAIL_MARK} side="right" />
          {nav.updates.length > 0 ? <UpdateButton items={nav.updates} side="right" /> : footerEnd}
        </div>
        <ModuleBackgrounds modules={nav.modules} />
      </div>
      {/* Folded, the panel stays mounted (the roster polls the bots) but takes no room. */}
      <div className={cn('tone-step flex min-w-0 flex-1 flex-col', !open && 'hidden')}>
        <div className="mb-2 flex h-14 shrink-0 items-center gap-2.5 pr-3 pl-4" style={dragRegion}>
          <TalyxLogo size={18} className="text-foreground" />
          <span className="text-xs font-semibold text-foreground">Talyx</span>
          <span className="ml-auto flex items-center gap-1" style={noDragRegion}>
            {titleEnd}
            <IconButton ref={foldRef} label={t('sidebar.collapse')} onClick={() => fold(false)}>
              <PanelLeftClose />
            </IconButton>
          </span>
        </div>
        {content}
      </div>
      {open && resizer}
    </aside>
  )
}

/** A page in the rail as an icon named by its tooltip. */
function RailPage({ page, index }: { page: DockSection; index: number }): React.JSX.Element {
  const view = viewOf(page)
  const active = useNavigation((s) => s.currentView === view)
  const navigate = useNavigation((s) => s.navigate)
  return (
    <span className="relative">
      <IconButton
        label={page.label}
        shortcut={`${mod}${index + 1}`}
        side="right"
        aria-current={active ? 'page' : undefined}
        onClick={() => void navigate(view)}
        className={cn(
          RAIL_MARK,
          'size-10 transition-[background-color,scale] duration-150 ease-out motion-safe:enabled:active:scale-[0.96]',
          active && 'bg-muted text-foreground enabled:hover:bg-muted'
        )}
      >
        <PageGlyph name={glyphOf(page)} size={22} />
      </IconButton>
      {page.unread && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1 right-1 size-1.5 rounded-full bg-foreground"
        />
      )}
    </span>
  )
}
