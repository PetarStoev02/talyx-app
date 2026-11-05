import { useEffect, useState } from 'react'
import { TalyxLogo } from '@shared/ui/TalyxLogo'
import { useLanguage } from '@app/providers/useLanguage'
import { settingsApi } from '@shared/api/ipc'
import { reportError } from '@shared/lib/report'
import { SIDEBAR_WIDTH, clampSidebarWidth } from '../../../../shared/sidebar'
import { SidebarFooter } from './SidebarFooter'

const isMac = (window.electron?.platform ?? 'darwin') === 'darwin'
const dragRegion = { WebkitAppRegion: 'drag' } as React.CSSProperties
const noDragRegion = { WebkitAppRegion: 'no-drag' } as React.CSSProperties
// One arrow-key press on the resize handle; Shift moves four times as far.
const KEY_STEP_PX = 16

export function AppShell({
  children,
  roster,
  titleEnd,
  footerEnd
}: {
  children: React.ReactNode
  roster: React.ReactNode | null
  // The far end of the title row: the roster's `+`.
  titleEnd: React.ReactNode
  // The far end of the footer row: the roster's refresh (the update button while one is pending).
  footerEnd: React.ReactNode
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [width, setWidth] = useState<number>(SIDEBAR_WIDTH.initial)

  useEffect(() => {
    settingsApi
      .get()
      .then((s) => setWidth(clampSidebarWidth(s.sidebarWidth)))
      // Unreadable settings leave the first width on screen; the log says why.
      .catch((error: unknown) => reportError('settings', error))
  }, [])

  return (
    <div className="flex h-screen">
      <aside className="tone-step relative flex h-full shrink-0 flex-col" style={{ width }}>
        {/* One 56px title row: the macOS window buttons (x16–68), then the logo. The left padding
            clears the window buttons; the blank space drags the window. */}
        <div
          className={`mb-2 flex h-14 shrink-0 items-center gap-2.5 pr-3 ${isMac ? 'pl-[92px]' : 'pl-4'}`}
          style={dragRegion}
        >
          <TalyxLogo size={18} className="text-foreground" />
          <span className="text-xs font-semibold text-foreground">Talyx</span>
          <span className="text-xs text-muted-foreground">{t('app.alpha')}</span>
          {/* Buttons in the title row must opt out of the window drag to take clicks. */}
          <span className="ml-auto" style={noDragRegion}>
            {titleEnd}
          </span>
        </div>
        {roster ?? <div className="flex-1" />}
        <SidebarFooter withRoster={!!roster} end={footerEnd} />
        <SidebarResizer
          width={width}
          label={t('sidebar.resize')}
          onResize={setWidth}
          onCommit={(sidebarWidth) => settingsApi.save({ sidebarWidth })}
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

/**
 * The sidebar's right edge: drag it, or focus it and use the arrow keys, Home and End. The width
 * is saved once a drag or a key press ends.
 */
function SidebarResizer({
  width,
  label,
  onResize,
  onCommit
}: {
  width: number
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
      // The sidebar starts at the window's left edge, so the pointer's x is the new width.
      onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          onResize(clampSidebarWidth(event.clientX))
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
