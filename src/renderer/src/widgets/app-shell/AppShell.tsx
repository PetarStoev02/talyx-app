import { useEffect, useRef } from 'react'
import { PanelLeft } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { Kbd } from '@shared/ui/kbd'
import { TalyxLogo } from '@shared/ui/TalyxLogo'
import { Tooltip, TooltipTrigger, TooltipContent } from '@shared/ui/tooltip'
import { useShell } from '@app/providers/useShell'
import { useLanguage } from '@app/providers/useLanguage'
import { useAutoUpdater } from '@shared/hooks/useAutoUpdater'
import { settingsApi } from '@shared/api/ipc'
import { SidebarNav } from './SidebarNav'
import { QuickActions } from './QuickActions'
import { SidebarFooter } from './SidebarFooter'

const isMac = (window.electron?.platform ?? 'darwin') === 'darwin'
const dragRegion = { WebkitAppRegion: 'drag' } as React.CSSProperties
const noDragRegion = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

export function AppShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const collapsed = useShell((s) => s.sidebarCollapsed)
  const toggleSidebar = useShell((s) => s.toggleSidebar)
  const setSidebarCollapsed = useShell((s) => s.setSidebarCollapsed)
  const t = useLanguage((s) => s.t)
  const hydrated = useRef(false)
  const { status, version, openReleasePage } = useAutoUpdater()

  useEffect(() => {
    settingsApi
      .get()
      .then((s) => setSidebarCollapsed(s.sidebarCollapsed ?? false))
      .finally(() => {
        hydrated.current = true
      })
  }, [setSidebarCollapsed])

  // Persist every change after hydration — covers both the button and the ⌘\ shortcut
  useEffect(() => {
    if (hydrated.current) settingsApi.set({ sidebarCollapsed: collapsed })
  }, [collapsed])

  return (
    <div className="flex h-screen">
      {/* No background of its own — inherits the window vibrancy + ambient glow */}
      <aside
        className={cn(
          'flex h-full shrink-0 flex-col border-r border-border/60 transition-[width] duration-150',
          collapsed ? 'w-[52px]' : 'w-[240px]'
        )}
      >
        {/* Collapsed: pure drag/traffic-light space — the 52px strip sits under the
            macOS window buttons (x16–68), so the toggle moves below into the icon column */}
        {/* Expanded: one title row — traffic lights, collapse toggle, then the logo,
            like T3 Code. The left padding clears the macOS window buttons (x16–68). */}
        <div
          className={cn(
            'flex h-11 shrink-0 items-center gap-3 pr-2',
            !collapsed && 'mb-2',
            isMac && !collapsed ? 'pl-[92px]' : 'pl-3'
          )}
          style={dragRegion}
        >
          {!collapsed && (
            <>
              <CollapseToggle onToggle={toggleSidebar} label={t('sidebar.collapse')} />
              <span className="flex items-center gap-2.5">
                <TalyxLogo size={18} className="text-foreground" />
                <span className="text-[13px] font-semibold text-foreground">Talyx</span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('app.alpha')}
                </span>
              </span>
            </>
          )}
        </div>

        {collapsed && (
          <div className="flex shrink-0 justify-center pb-1">
            <CollapseToggle
              onToggle={toggleSidebar}
              label={t('sidebar.expand')}
              className="size-9 rounded-md [&_svg]:size-[18px]"
            />
          </div>
        )}

        <QuickActions />
        <SidebarNav collapsed={collapsed} />
        <div className="flex-1" />
        <SidebarFooter
          collapsed={collapsed}
          updater={{ status, version, onOpen: openReleasePage }}
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
function CollapseToggle({
  onToggle,
  label,
  className
}: {
  onToggle: () => void
  label: string
  className?: string
}): React.JSX.Element {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          onClick={onToggle}
          aria-label={label}
          style={noDragRegion}
          className={cn(
            'flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground',
            className
          )}
        >
          <PanelLeft className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="flex items-center gap-2">
        {label}
        <Kbd>{isMac ? '⌘\\' : 'Ctrl+\\'}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}
