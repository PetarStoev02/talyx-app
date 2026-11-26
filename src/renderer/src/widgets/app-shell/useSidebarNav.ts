import { useEngine } from '@features/setup/store'
import { useLanguage } from '@shared/lib/i18n'
import { type AppView, useNavigation } from '@features/modules/store'
import { useRoster } from '@features/bots/store'
import { layerOpen, platformOf } from '@features/shortcuts/shortcuts'
import { anyUnread, dockSections, dockShortcut, type DockSection } from '@features/modules/sections'
import { moduleView, runningModules, useModuleAttention, useModules } from '@features/modules/store'
import { moduleRows } from '@features/modules/rows'
import { updateItems, type UpdateItem } from '@features/updates/items'
import { useUpdates } from '@features/updates/store'
import type { ModuleSummary } from '@contract/modules'
import { reportError } from '@shared/lib/report'
import { MINUTE_MS } from '@shared/lib/time'
import { useOnMount, useWindowEvent } from '@shared/hooks/useSubscription'
import type { PageGlyphName } from './PageGlyph'

const isMac = platformOf(navigator.platform) === 'mac'
export const mod = isMac ? '⌘' : 'Ctrl+'
// Coming back to the window reads the module catalog again, at most this often.
const CATALOG_FOCUS_MAX_AGE_MS = 15 * MINUTE_MS

export interface SidebarNav {
  /** The dock's pages: empty without a running module. */
  dock: DockSection[]
  /** The agents and each running module, whether or not the dock shows. */
  pages: DockSection[]
  modules: ModuleSummary[]
  updates: UpdateItem[]
}

/**
 * What every sidebar layout shows for navigation: its pages and their dots, and pending updates. Also loads modules, the module catalog and updates and binds ⌘1, ⌘2, … to the pages in order.
 */
export function useSidebarNav(): SidebarNav {
  const t = useLanguage((s) => s.t)
  const engine = useEngine((s) => s.status)
  const update = useUpdates((s) => s.state)
  const modulesState = useModules((s) => s.state)
  const catalog = useModules((s) => s.catalog)
  const modules = runningModules(modulesState)
  const unread = useRoster((s) => anyUnread(s.unread, s.roomUnread))
  const needsYou = useModuleAttention((s) => s.needsYou)
  // The dot is only drawn; the name carries it for screen readers.
  const agents = {
    label: unread ? t('nav.unread').replace('{section}', t('nav.agents')) : t('nav.agents'),
    unread
  }
  const dock = dockSections(modules, agents, (module) => {
    const count = needsYou[module.id] ?? 0
    return {
      label:
        count > 0
          ? t('nav.needsYou').replace('{section}', module.name).replace('{count}', String(count))
          : module.name,
      unread: count > 0
    }
  })
  const pages = dock.length > 0 ? dock : [{ key: 'agents', moduleId: null, ...agents }]
  useDockShortcuts(pages.map(viewOf))
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

  return {
    dock,
    pages,
    modules,
    updates: updateItems(engine, update, moduleRows(modulesState, catalog))
  }
}

export function viewOf(section: DockSection): AppView {
  return section.moduleId ? moduleView(section.moduleId) : 'agents'
}

/** Talyx's mark for the agents; the stairs for every module, until a module can hand its own. */
export function glyphOf(section: DockSection): PageGlyphName {
  return section.moduleId ? 'module' : 'agents'
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
