import type { ModuleSummary } from '../../../../shared/modules'
import { moduleIdOf, moduleView } from './store'

/** One button in the footer's dock: the agents, or one running module. */
export interface SidebarSection {
  key: string
  /** The module it opens; null for the agents. */
  moduleId: string | null
  label: string
  active: boolean
  /** Only the agents carry it: a bot has a reply you have not read. */
  unread: boolean
}

/**
 * The footer's dock. Without a running module there is none: someone who never bought a
 * module sees the sidebar as it always was. Settings belongs to the agents' side.
 */
export function sidebarSections(
  modules: ModuleSummary[],
  currentView: string,
  agents: { label: string; unread: boolean }
): SidebarSection[] {
  if (modules.length === 0) return []
  const open = moduleIdOf(currentView)
  return [
    { key: 'agents', moduleId: null, label: agents.label, active: !open, unread: agents.unread },
    ...modules.map((module) => ({
      key: moduleView(module.id),
      moduleId: module.id,
      label: module.name,
      active: open === module.id,
      unread: false
    }))
  ]
}

/** Whether any bot or room has a reply you have not read. */
export function anyUnread(...marks: Record<string, boolean>[]): boolean {
  return marks.some((byId) => Object.values(byId).some(Boolean))
}
