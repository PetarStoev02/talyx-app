import { useState } from 'react'
import { PanelLeftClose } from 'lucide-react'
import { useOnMount } from '@shared/hooks/useSubscription'
import { useLanguage } from '@shared/lib/i18n'
import { cn } from '@shared/lib/utils'
import { settingsApi } from '@shared/api/ipc'
import { reportError } from '@shared/lib/report'
import { IconButton } from '@shared/ui/IconButton'
import { useLayoutPick } from '@features/settings/store'
import { SIDEBAR_WIDTH, clampSidebarWidth } from '@contract/sidebar'
import { LayeredRail } from './LayeredSidebar'
import { ModuleBackgrounds } from './ModuleBackground'
import { SidebarFooter } from './SidebarFooter'
import { TitleRow } from './TitleRow'
import { usePanelFold } from './usePanelFold'
import { useSidebarNav } from './useSidebarNav'
import { LAYERED_RAIL_PX, noDragRegion } from './windowChrome'

// One arrow-key press on the resize handle; Shift moves four times as far.
const KEY_STEP_PX = 16

/**
 * The sidebar and the page, in either layout. Dock: one column, its pages in the footer's dock.
 * Layered: a rail of pages, the panel beside it (it folds away) and the page as a card. Both draw
 * the same boxes in the same order, so switching layouts never remounts the roster (its first read
 * writes Talyx's rules to every bot) or the page.
 */
export function AppShell({
  children,
  roster,
  sidebar,
  titleEnd,
  footerEnd
}: {
  children: React.ReactNode
  roster: React.ReactNode | null
  // A module's own sidebar while its page is open; it hides the roster without unmounting it.
  sidebar?: React.ReactNode
  // The far end of the title row: the roster's `+`.
  titleEnd: React.ReactNode
  // The far end of the footer row: the roster's refresh (the update button while one is pending).
  footerEnd: React.ReactNode
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const layered = useLayoutPick((s) => s.layout) === 'layered'
  const nav = useSidebarNav()
  const { open: panelOpen, sliding, fold, settle, foldRef, unfoldRef } = usePanelFold()
  const [width, setWidth] = useState<number>(SIDEBAR_WIDTH.initial)
  const open = !layered || panelOpen

  useOnMount(() => {
    settingsApi
      .get()
      .then((s) => setWidth(clampSidebarWidth(s.sidebarWidth)))
      // Unreadable settings leave the first width on screen; the log says why.
      .catch((error: unknown) => reportError('settings', error))
  })

  return (
    <div className="flex h-screen">
      <aside className="relative flex h-full shrink-0">
        {layered && (
          <LayeredRail
            nav={nav}
            folded={!open}
            onUnfold={() => fold(true)}
            unfoldRef={unfoldRef}
            footerEnd={footerEnd}
          />
        )}
        {/* The panel slides shut like the details panel; folded, it stays mounted (the roster polls
            the bots) but takes no room and no focus. */}
        <div
          inert={!open}
          onTransitionEnd={(event) => event.target === event.currentTarget && settle()}
          // A theme switch cuts transitions short; the slide is over then too.
          // eslint-disable-next-line react/no-unknown-property -- a React 19 event the rule predates
          onTransitionCancel={(event) => event.target === event.currentTarget && settle()}
          className={cn(
            'flex h-full shrink-0 overflow-hidden',
            sliding && 'transition-[width] duration-(--duration-move) ease-(--ease-in-out)'
          )}
          style={{ width: open ? width : 0 }}
        >
          <div className="tone-step flex h-full shrink-0 flex-col" style={{ width }}>
            <TitleRow
              besideWindowButtons={!layered}
              end={
                <>
                  {titleEnd}
                  {layered && (
                    <IconButton
                      ref={foldRef}
                      label={t('sidebar.collapse')}
                      onClick={() => fold(false)}
                    >
                      <PanelLeftClose />
                    </IconButton>
                  )}
                </>
              }
            />
            {sidebar}
            {/* Always here, so switching sections never remounts it (it polls the bots); hidden
                while a module's sidebar stands before it. */}
            <div data-roster className="contents [[data-module-sidebar]~&]:hidden">
              {roster ?? <div className="flex-1" />}
            </div>
            {!layered && <SidebarFooter end={footerEnd} nav={nav} />}
          </div>
        </div>
        {open && (
          <SidebarResizer
            width={width}
            offset={layered ? LAYERED_RAIL_PX : 0}
            label={t('sidebar.resize')}
            onResize={setWidth}
            onCommit={(sidebarWidth) => settingsApi.save({ sidebarWidth })}
          />
        )}
        {/* Here, in either layout, so each module's Background keeps watching whatever page is
            open and never restarts on a layout switch. */}
        <ModuleBackgrounds modules={nav.modules} />
      </aside>
      {/* Layered, the page floats as a card on the tone step, apart from both navigation columns. */}
      <div className={cn('flex min-w-0 flex-1', layered && 'bg-muted py-2 pr-2')}>
        <div
          data-layered={layered ? '' : undefined}
          className={cn(
            'flex min-w-0 flex-1 flex-col',
            layered &&
              'overflow-hidden rounded-2xl border border-transparent bg-background shadow-xs'
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * The sidebar's right edge: drag it, or focus it and use the arrow keys, Home and End. The width
 * is saved once a drag or a key press ends.
 */
function SidebarResizer({
  width,
  offset,
  label,
  onResize,
  onCommit
}: {
  width: number
  // Where the resized column starts: past the rail, if there is one.
  offset: number
  label: string
  onResize: (width: number) => void
  onCommit: (width: number) => void
}): React.JSX.Element {
  function onKeyDown(event: React.KeyboardEvent): void {
    const step = event.shiftKey ? KEY_STEP_PX * 4 : KEY_STEP_PX
    const next =
      event.key === 'ArrowLeft'
        ? width - step
        : event.key === 'ArrowRight'
          ? width + step
          : event.key === 'Home'
            ? SIDEBAR_WIDTH.min
            : event.key === 'End'
              ? SIDEBAR_WIDTH.max
              : null
    if (next === null) return
    event.preventDefault()
    const clamped = clampSidebarWidth(next)
    onResize(clamped)
    onCommit(clamped)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={SIDEBAR_WIDTH.min}
      aria-valuemax={SIDEBAR_WIDTH.max}
      aria-valuenow={width}
      tabIndex={0}
      onKeyDown={onKeyDown}
      // The resized column starts `offset` px from the window's left edge.
      onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          onResize(clampSidebarWidth(event.clientX - offset))
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId)
        // The width the drag left, so a click without a drag changes nothing.
        onCommit(width)
      }}
      style={noDragRegion}
      // Just past the sidebar's edge, so it never covers the roster's scrollbar.
      className="absolute inset-y-0 left-full z-10 w-2 cursor-col-resize touch-none select-none after:absolute after:inset-y-0 after:left-0 after:w-px after:transition-colors hover:after:bg-border focus-visible:after:bg-ring active:after:bg-ring"
    />
  )
}
