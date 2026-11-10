import { CalendarPlus, FilePlus, FolderPlus, ListPlus, Plus, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createItemsOf } from '@features/modules/host'
import type { ModuleCreate, ModuleCreateIcon } from '@features/modules/host'
import type { MenuAction } from '@shared/ui/menu'

// What each icon a module may name draws, from the app's own icon set.
const CREATE_ICONS: Record<ModuleCreateIcon, LucideIcon> = {
  plus: Plus,
  task: ListPlus,
  workflow: Workflow,
  folder: FolderPlus,
  file: FilePlus,
  calendar: CalendarPlus
}

export interface AddMenu {
  label: string
  actions: MenuAction[]
}

/**
 * The sidebar's `+` for the section open: the module's own create items while its page is open,
 * else (on the agents, or a module offering none) a bot, a room or a folder. A module whose items
 * fail to load falls back too, and the failure goes to `report`.
 */
export function addMenu(
  // The module open, with the `+`'s name for when it gives none.
  section: { create: ModuleCreate | null; label: string } | null,
  agents: AddMenu,
  report: (error: unknown) => void
): AddMenu {
  if (!section?.create) return agents
  let items: ReturnType<typeof createItemsOf> = []
  try {
    items = createItemsOf(section.create)
  } catch (error) {
    report(error)
  }
  if (items.length === 0) return agents
  return {
    label: section.create.label ?? section.label,
    actions: items.map((item) => ({
      label: item.label,
      icon: item.icon ? CREATE_ICONS[item.icon] : undefined,
      onSelect: item.run
    }))
  }
}
