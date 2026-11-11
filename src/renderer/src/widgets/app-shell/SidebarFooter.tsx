import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import { type AppView, useNavigation } from '@app/providers/useNavigation'
import { IconButton } from '@shared/ui/IconButton'
import { useRoster } from '@features/bots/store'
import { anyUnread, sidebarSections, type SidebarSection } from '@features/modules/sections'
import { moduleView, runningModules } from '@features/modules/store'
import { useEngine } from '@app/providers/useEngine'
import { useLanguage } from '@app/providers/useLanguage'
import { updateItems } from '@features/updates/items'
import { useUpdates } from '@features/updates/store'
import { useModules } from '@features/modules/store'
import { reportError } from '@shared/lib/report'
import { NavButton } from './NavButton'
import { UpdateButton } from './UpdateButton'

const isMac = navigator.platform.toLowerCase().includes('mac')
const mod = isMac ? '⌘' : 'Ctrl+'

/**
 * Settings on the left, `end` (the roster's refresh) on the right, and between them the dock: Agents
 * and each running module, with ⌘1, ⌘2, … in that order. Without a running module there is no
 * dock, and Settings closes itself back to the agents. While a Talyx or engine update is pending,
 * the update button takes `end`'s place.
 */
export function SidebarFooter({ end }: { end: React.ReactNode }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const engine = useEngine((s) => s.status)
  const update = useUpdates((s) => s.state)
  const items = updateItems(engine, update)
  const settingsOpen = useNavigation((s) => s.currentView === 'settings')
  const navigate = useNavigation((s) => s.navigate)
  const modules = runningModules(useModules((s) => s.state))
  const unread = useRoster((s) => anyUnread(s.unread, s.roomUnread))
  const currentView = useNavigation((s) => s.currentView)
  // Agents and the running modules; none at all without a running module, since Agents alone is
  // no choice to make. A module nobody installed or unlocked never appears.
  const sections = sidebarSections(modules, currentView, {
    // The unread dot is only drawn; the name carries the new replies for screen readers.
    label: unread ? t('nav.unread').replace('{section}', t('nav.agents')) : t('nav.agents'),
    unread
  })
  const showDock = sections.length > 0
  const viewOf = (section: SidebarSection): AppView =>
    section.moduleId ? moduleView(section.moduleId) : 'agents'
  const dockViews: AppView[] = showDock ? sections.map(viewOf) : ['agents']

  // ⌘1, ⌘2, … open the dock's pages in the order they sit.
  const dockKey = dockViews.join(' ')
  useEffect(() => {
    const views = dockKey.split(' ') as AppView[]
    function onKey(event: KeyboardEvent): void {
      if (!(isMac ? event.metaKey : event.ctrlKey)) return
      const view = views[Number(event.key) - 1]
      if (!view) return
      event.preventDefault()
      void navigate(view)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dockKey, navigate])

  useEffect(() => {
    useModules
      .getState()
      .load()
      .catch((error: unknown) => reportError('modules', error))
  }, [])

  useEffect(() => {
    useUpdates
      .getState()
      .load()
      .catch((error: unknown) => reportError('updater', error))
  }, [])

  return (
    // Settings on the left and refresh on the right, as plain icon buttons; the dock of pages sits
    // centred between them.
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pt-2 pb-3">
      <span className="justify-self-start">
        <IconButton
          // Without a dock there is no Agents button, so Settings closes itself back to the agents.
          label={settingsOpen && !showDock ? t('nav.closeSettings') : t('nav.settings')}
          shortcut={`${mod},`}
          aria-current={settingsOpen ? 'page' : undefined}
          onClick={() => navigate(settingsOpen && !showDock ? 'agents' : 'settings')}
          className={settingsOpen ? 'bg-foreground/10 text-foreground' : undefined}
        >
          <Settings />
        </IconButton>
      </span>
      {showDock ? (
        <nav
          aria-label={t('nav.sections')}
          className="relative flex items-center gap-0.5 rounded-full bg-foreground/[0.05] p-1"
        >
          <DockIndicator views={dockViews} />
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
      ) : (
        <span />
      )}
      <span className="justify-self-end">
        {items.length > 0 ? <UpdateButton items={items} /> : end}
      </span>
    </div>
  )
}

// The dock's geometry: 32px buttons, 2px apart, inside 4px of padding.
const BUTTON_PX = 32
const GAP_PX = 2
const PAD_PX = 4
const STEP_PX = BUTTON_PX + GAP_PX
// The edge that leads the move goes first; the trailing edge follows this much later, so the disc
// stretches toward the new page and then gathers there, like a drop of liquid.
const TRAIL_MS = 90

/** The white disc under the open page in the dock. Hidden while a page outside the dock is open. */
function DockIndicator({ views }: { views: AppView[] }): React.JSX.Element {
  const index = useNavigation((s) => views.indexOf(s.currentView))
  // The last page in the dock and the one before it; leaving to Settings keeps both, so coming
  // back slides from where the disc was.
  const [move, setMove] = useState({ to: index, from: index })
  if (index >= 0 && index !== move.to) setMove({ to: index, from: move.to })
  const movingRight = move.to > move.from
  const movingLeft = move.to < move.from
  const at = Math.max(index, 0)
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
