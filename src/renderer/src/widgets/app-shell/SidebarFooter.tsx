import { useState } from 'react'
import { ChartNoAxesColumn, Settings } from 'lucide-react'
import { useEngine } from '@features/setup/store'
import { useLanguage } from '@shared/lib/i18n'
import { type AppView, useNavigation } from '@features/modules/store'
import { useRoster } from '@features/bots/store'
import { layerOpen, platformOf } from '@features/shortcuts/shortcuts'
import { anyUnread, dockSections, dockShortcut, type DockSection } from '@features/modules/sections'
import { moduleRows } from '@features/modules/rows'
import { moduleView, runningModules, useModuleAttention, useModules } from '@features/modules/store'
import { updateItems } from '@features/updates/items'
import { useUpdates } from '@features/updates/store'
import { reportError } from '@shared/lib/report'
import { MINUTE_MS } from '@shared/lib/time'
import { IconButton } from '@shared/ui/IconButton'
import { useOnMount, useWindowEvent } from '@shared/hooks/useSubscription'
import { ModuleBackground } from './ModuleBackground'
import { NavButton } from './NavButton'
import { UpdateButton } from './UpdateButton'

const isMac = platformOf(navigator.platform) === 'mac'
const mod = isMac ? '⌘' : 'Ctrl+'
// Coming back to the window reads the module catalog again, at most this often.
const CATALOG_FOCUS_MAX_AGE_MS = 15 * MINUTE_MS

/**
 * Settings and Usage on the left, `end` (the roster's refresh) on the right, and between them the dock: Agents
 * and each running module, with ⌘1, ⌘2, … in that order. Without a running module there is no
 * dock. Settings and Usage toggle: open, each closes back to the page it was opened from. While a Talyx,
 * engine or module update is pending, the update button takes `end`'s place. Each running module's
 * Background lives here too, so it keeps watching whatever page is open.
 */
export function SidebarFooter({ end }: { end: React.ReactNode }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const engine = useEngine((s) => s.status)
  const update = useUpdates((s) => s.state)
  const modulesState = useModules((s) => s.state)
  const catalog = useModules((s) => s.catalog)
  const items = updateItems(engine, update, moduleRows(modulesState, catalog))
  const currentView = useNavigation((s) => s.currentView)
  const toggle = useNavigation((s) => s.toggle)
  const settingsOpen = currentView === 'settings'
  const usageOpen = currentView === 'usage'
  const modules = runningModules(modulesState)
  const unread = useRoster((s) => anyUnread(s.unread, s.roomUnread))
  const needsYou = useModuleAttention((s) => s.needsYou)
  // The dot is only drawn; the name carries it for screen readers.
  const sections = dockSections(
    modules,
    {
      label: unread ? t('nav.unread').replace('{section}', t('nav.agents')) : t('nav.agents'),
      unread
    },
    (module) => {
      const count = needsYou[module.id] ?? 0
      return {
        label:
          count > 0
            ? t('nav.needsYou').replace('{section}', module.name).replace('{count}', String(count))
            : module.name,
        unread: count > 0
      }
    }
  )
  const showDock = sections.length > 0
  // Without a dock, ⌘1 still opens the agents.
  useDockShortcuts(showDock ? sections.map(viewOf) : ['agents'])
  useWindowEvent('focus', () => void useModules.getState().readCatalog(CATALOG_FOCUS_MAX_AGE_MS))

  useOnMount(() => {
    const { load, readCatalog } = useModules.getState()
    load()
      .then(() => readCatalog(0))
      .catch((error: unknown) => reportError('modules', error))
    useUpdates
      .getState()
      .load()
      .catch((error: unknown) => reportError('updater', error))
  })

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pt-2 pb-3">
      <span className="flex justify-self-start">
        <IconButton
          label={settingsOpen ? t('nav.closeSettings') : t('nav.settings')}
          shortcut={`${mod},`}
          aria-current={settingsOpen ? 'page' : undefined}
          onClick={() => void toggle('settings')}
          className={settingsOpen ? 'bg-foreground/10 text-foreground' : undefined}
        >
          <Settings />
        </IconButton>
        <IconButton
          label={usageOpen ? t('nav.closeUsage') : t('nav.usage')}
          aria-current={usageOpen ? 'page' : undefined}
          onClick={() => void toggle('usage')}
          className={usageOpen ? 'bg-foreground/10 text-foreground' : undefined}
        >
          <ChartNoAxesColumn />
        </IconButton>
      </span>
      {showDock ? <Dock sections={sections} label={t('nav.sections')} /> : <span />}
      {/* Hidden: a Background draws nothing, and a failed one's notice must not take a cell. */}
      <div hidden>
        {modules.map((module) => (
          // Keyed by version too: an update starts its Background afresh, with no dot left over.
          <ModuleBackground key={`${module.id}@${module.version}`} module={module} />
        ))}
      </div>
      <span className="justify-self-end">
        {items.length > 0 ? <UpdateButton items={items} /> : end}
      </span>
    </div>
  )
}

function viewOf(section: DockSection): AppView {
  return section.moduleId ? moduleView(section.moduleId) : 'agents'
}

/** ⌘1, ⌘2, … (Ctrl on Linux) open `views` in order. */
function useDockShortcuts(views: AppView[]): void {
  const navigate = useNavigation((s) => s.navigate)
  useWindowEvent('keydown', (event) => {
    if (!(isMac ? event.metaKey : event.ctrlKey) || layerOpen()) return
    const view = dockShortcut(views, event.key)
    if (!view) return
    event.preventDefault()
    void navigate(view)
  })
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
            glyph={section.moduleId ? 'module' : 'agents'}
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
