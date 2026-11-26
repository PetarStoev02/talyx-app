import { PanelLeftOpen } from 'lucide-react'
import { useLanguage } from '@shared/lib/i18n'
import { useNavigation } from '@features/modules/store'
import type { DockSection } from '@features/modules/sections'
import { IconButton } from '@shared/ui/IconButton'
import { PageGlyph } from './PageGlyph'
import { PageIndicator } from './PageIndicator'
import { ViewToggles } from './SidebarFooter'
import { RAIL_BAR, RAIL_MARK } from './pageMarks'
import { UpdateButton } from './UpdateButton'
import { glyphOf, mod, type SidebarNav, viewOf } from './useSidebarNav'
import { LAYERED_RAIL_PX, dragRegion } from './windowChrome'

// The rail's geometry as its classes draw it: RailPage's size-10 and the column's gap-1.
const PAGE_PX = 40
const GAP_PX = 4

/**
 * The Layered layout's rail: its pages on the ground, with Settings, Usage and the refresh at its
 * foot, and Show sidebar there while the panel is folded. The macOS window buttons sit on it.
 */
export function LayeredRail({
  nav,
  folded,
  onUnfold,
  unfoldRef,
  footerEnd
}: {
  nav: SidebarNav
  folded: boolean
  onUnfold: () => void
  unfoldRef: React.RefObject<HTMLButtonElement | null>
  footerEnd: React.ReactNode
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
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
        className="flex min-h-0 w-full scroll-fade flex-col overflow-y-auto overscroll-contain py-1 [scrollbar-width:none]"
      >
        <div className="relative flex w-full flex-col items-center gap-1">
          {/* The dock's sliding disc, turned upright, with the open page's bar riding on it. */}
          <PageIndicator
            views={nav.pages.map(viewOf)}
            axis="y"
            step={PAGE_PX + GAP_PX}
            pad={0}
            className={`left-1/2 w-10 -translate-x-1/2 rounded-full bg-muted ${RAIL_BAR}`}
          />
          {nav.pages.map((page, i) => (
            <RailPage key={page.key} page={page} index={i} />
          ))}
        </div>
      </nav>
      <div className="mt-auto flex shrink-0 flex-col items-center gap-1 pt-2">
        {folded && (
          <IconButton ref={unfoldRef} label={t('sidebar.expand')} side="right" onClick={onUnfold}>
            <PanelLeftOpen />
          </IconButton>
        )}
        <ViewToggles className="flex flex-col items-center gap-1" mark={RAIL_MARK} side="right" />
        {nav.updates.length > 0 ? <UpdateButton items={nav.updates} side="right" /> : footerEnd}
      </div>
    </div>
  )
}

/** A page in the rail as an icon named by its tooltip; it answers like a page in the dock. */
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
        className="size-10 transition-[opacity,scale] duration-150 ease-out motion-safe:enabled:active:scale-[0.96] enabled:hover:bg-transparent hover:opacity-75 aria-[current=page]:text-foreground aria-[current=page]:hover:opacity-100"
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
