import { ChartNoAxesColumn, Settings } from 'lucide-react'
import { useLanguage } from '@shared/lib/i18n'
import { useNavigation } from '@features/modules/store'
import type { DockSection } from '@features/modules/sections'
import { IconButton } from '@shared/ui/IconButton'
import { cn } from '@shared/lib/utils'
import { DOCK_MARK } from './pageMarks'
import { NavButton } from './NavButton'
import { PageIndicator } from './PageIndicator'
import { UpdateButton } from './UpdateButton'
import { glyphOf, mod, type SidebarNav, viewOf } from './useSidebarNav'

/**
 * Settings and Usage on the left, `end` (the roster's refresh) on the right, and between them the dock: Agents
 * and each running module, with ⌘1, ⌘2, … in that order. Without a running module there is no
 * dock. Settings and Usage toggle: open, each closes back to the page it was opened from. While a Talyx,
 * engine or module update is pending, the update button takes `end`'s place.
 */
export function SidebarFooter({
  end,
  nav
}: {
  end: React.ReactNode
  nav: SidebarNav
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const { dock, updates } = nav
  const showDock = dock.length > 0

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pt-2 pb-3">
      <ViewToggles className="flex justify-self-start" mark={DOCK_MARK} />
      {showDock ? <Dock sections={dock} label={t('nav.sections')} /> : <span />}
      <span className="justify-self-end">
        {updates.length > 0 ? <UpdateButton items={updates} /> : end}
      </span>
    </div>
  )
}

/** Settings and Usage; each toggles back to the page it was opened from. */
export function ViewToggles({
  className,
  mark,
  side = 'top'
}: {
  className: string
  // Marks the open page: DOCK_MARK or RAIL_MARK.
  mark: string
  side?: 'top' | 'right'
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const currentView = useNavigation((s) => s.currentView)
  const toggle = useNavigation((s) => s.toggle)
  const settingsOpen = currentView === 'settings'
  const usageOpen = currentView === 'usage'
  return (
    <span className={className}>
      <IconButton
        label={settingsOpen ? t('nav.closeSettings') : t('nav.settings')}
        shortcut={`${mod},`}
        side={side}
        aria-current={settingsOpen ? 'page' : undefined}
        onClick={() => void toggle('settings')}
        className={cn(mark, settingsOpen && 'bg-foreground/10 text-foreground')}
      >
        <Settings />
      </IconButton>
      <IconButton
        label={usageOpen ? t('nav.closeUsage') : t('nav.usage')}
        side={side}
        aria-current={usageOpen ? 'page' : undefined}
        onClick={() => void toggle('usage')}
        className={cn(mark, usageOpen && 'bg-foreground/10 text-foreground')}
      >
        <ChartNoAxesColumn />
      </IconButton>
    </span>
  )
}

/** The dock: one glyph per page, the open one on a sliding disc. */
function Dock({ sections, label }: { sections: DockSection[]; label: string }): React.JSX.Element {
  return (
    <nav
      aria-label={label}
      className="relative flex items-center gap-0.5 rounded-full bg-foreground/[0.05] p-1"
    >
      {/* The raised disc under the open page. */}
      <PageIndicator
        views={sections.map(viewOf)}
        axis="x"
        step={BUTTON_PX + GAP_PX}
        pad={PAD_PX}
        className="inset-y-1 rounded-full bg-background shadow-xs"
      />
      {sections.map((section, i) => (
        <span key={section.key} className="relative">
          <NavButton
            view={viewOf(section)}
            label={section.label}
            glyph={glyphOf(section)}
            shortcut={`${mod}${i + 1}`}
          />
          {section.unread && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1 right-1 z-10 size-1.5 rounded-full bg-foreground"
            />
          )}
        </span>
      ))}
    </nav>
  )
}

// The dock's geometry as its classes draw it: NavButton's size-8, the nav's gap-0.5 and p-1.
const BUTTON_PX = 32
const GAP_PX = 2
const PAD_PX = 4
