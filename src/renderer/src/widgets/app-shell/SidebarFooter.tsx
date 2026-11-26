import { useState } from 'react'
import { ChartNoAxesColumn, Settings } from 'lucide-react'
import { useLanguage } from '@shared/lib/i18n'
import { type AppView, useNavigation } from '@features/modules/store'
import type { DockSection } from '@features/modules/sections'
import { IconButton } from '@shared/ui/IconButton'
import { cn } from '@shared/lib/utils'
import { DOCK_MARK } from './pageMarks'
import { ModuleBackgrounds } from './ModuleBackground'
import { NavButton } from './NavButton'
import { UpdateButton } from './UpdateButton'
import { glyphOf, mod, useSidebarNav, viewOf } from './useSidebarNav'

/**
 * Settings and Usage on the left, `end` (the roster's refresh) on the right, and between them the dock: Agents
 * and each running module, with ⌘1, ⌘2, … in that order. Without a running module there is no
 * dock. Settings and Usage toggle: open, each closes back to the page it was opened from. While a Talyx,
 * engine or module update is pending, the update button takes `end`'s place. Each running module's
 * Background lives here too, so it keeps watching whatever page is open.
 */
export function SidebarFooter({ end }: { end: React.ReactNode }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const { dock, modules, updates } = useSidebarNav()
  const showDock = dock.length > 0

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pt-2 pb-3">
      <ViewToggles className="flex justify-self-start" mark={DOCK_MARK} />
      {showDock ? <Dock sections={dock} label={t('nav.sections')} /> : <span />}
      <ModuleBackgrounds modules={modules} />
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
      <DockIndicator views={sections.map(viewOf)} />
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
const STEP_PX = BUTTON_PX + GAP_PX
// The edge that leads the move goes first; the trailing edge follows this much later, so the disc
// stretches toward the new page and then gathers there, like a drop of liquid.
const TRAIL_MS = 90

/** The raised disc under the open page in the dock. Hidden while a page outside the dock is open. */
function DockIndicator({ views }: { views: AppView[] }): React.JSX.Element {
  const index = useNavigation((s) => views.indexOf(s.currentView))
  // The last page in the dock and the one before it. Leaving to Settings keeps both, and the disc
  // fades out where it was, so coming back slides it from there.
  const [move, setMove] = useState({ to: index, from: index })
  if (index >= 0 && index !== move.to) setMove({ to: index, from: move.to })
  const movingRight = move.to > move.from
  const movingLeft = move.to < move.from
  const at = index >= 0 ? index : Math.max(move.to, 0)
  return (
    <span
      aria-hidden="true"
      className={
        'pointer-events-none absolute inset-y-1 rounded-full bg-background shadow-xs ' +
        'transition-[left,right,opacity] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-[opacity] ' +
        (index < 0 ? 'opacity-0' : 'opacity-100')
      }
      style={{
        left: PAD_PX + at * STEP_PX,
        right: PAD_PX + (views.length - 1 - at) * STEP_PX,
        transitionDelay: movingRight
          ? `${TRAIL_MS}ms, 0ms, 0ms`
          : movingLeft
            ? `0ms, ${TRAIL_MS}ms, 0ms`
            : '0ms'
      }}
    />
  )
}
