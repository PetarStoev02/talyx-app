import type { ModuleSummary } from '../../../../shared/modules'
import { moduleView } from './store'

/** One button in the footer's dock: the agents, or one running module. */
export interface DockSection {
  key: string
  /** The module it opens; null for the agents. */
  moduleId: string | null
  label: string
  /** Only the agents carry it: a bot has a reply you have not read. */
  unread: boolean
}

/**
 * The footer's dock: the agents, then each running module. Without a running module there is
 * none, so someone who never bought a module never sees one.
 */
export function dockSections(
  modules: ModuleSummary[],
  agents: { label: string; unread: boolean }
): DockSection[] {
  if (modules.length === 0) return []
  return [
    { key: 'agents', moduleId: null, label: agents.label, unread: agents.unread },
    ...modules.map((module) => ({
      key: moduleView(module.id),
      moduleId: module.id,
      label: module.name,
      unread: false
    }))
  ]
}

/** The page ⌘1, ⌘2, … opens: the dock's pages in order; null for any other key. */
export function dockShortcut<View extends string>(views: View[], key: string): View | null {
  if (!/^[1-9]$/.test(key)) return null
  return views[Number(key) - 1] ?? null
}

/** Whether any bot or room has a reply you have not read. */
export function anyUnread(...marks: Record<string, boolean>[]): boolean {
  return marks.some((byId) => Object.values(byId).some(Boolean))
}
