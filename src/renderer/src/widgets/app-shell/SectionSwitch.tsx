import { Blocks, Bot } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { useNavigation } from '@app/providers/useNavigation'
import { useRoster } from '@features/bots/store'
import { moduleView, runningModules, useModules } from '@features/modules/store'
import { anyUnread, sidebarSections, type SidebarSection } from '@features/modules/sections'
import { useModuleParts } from '@features/modules/useModuleParts'
import { cn } from '@shared/lib/utils'
import type { ModuleSummary } from '../../../../shared/modules'

/**
 * Agents, then one button per running module, under the title row. Choosing a module opens its
 * page and hands it the sidebar. Without a running module there is no switch at all.
 */
export function SectionSwitch(): React.JSX.Element | null {
  const t = useLanguage((s) => s.t)
  const modules = runningModules(useModules((s) => s.state))
  const currentView = useNavigation((s) => s.currentView)
  const navigate = useNavigation((s) => s.navigate)
  const unread = useRoster((s) => anyUnread(s.unread, s.roomUnread))
  const sections = sidebarSections(modules, currentView, { label: t('nav.agents'), unread })
  if (sections.length === 0) return null

  return (
    <nav
      aria-label={t('nav.sections')}
      className="mx-3 mb-3 flex shrink-0 gap-1 rounded-full bg-foreground/[0.05] p-1"
    >
      {sections.map((section) => (
        <SectionButton
          key={section.key}
          section={section}
          module={modules.find((module) => module.id === section.moduleId) ?? null}
          unreadLabel={t('nav.unread').replace('{section}', section.label)}
          onOpen={() => navigate(section.moduleId ? moduleView(section.moduleId) : 'agents')}
        />
      ))}
    </nav>
  )
}

function SectionButton({
  section,
  module,
  unreadLabel,
  onOpen
}: {
  section: SidebarSection
  module: ModuleSummary | null
  unreadLabel: string
  onOpen: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-current={section.active ? 'page' : undefined}
      aria-label={section.unread ? unreadLabel : undefined}
      onClick={onOpen}
      className={cn(
        'relative flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-[background-color,color,scale] duration-(--duration-in) ease-(--ease-out) active:scale-[0.96] [&_svg]:size-4 [&_svg]:shrink-0',
        section.active
          ? 'bg-background text-foreground shadow-xs'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {module ? <ModuleIcon module={module} /> : <Bot aria-hidden="true" />}
      <span className="truncate">{section.label}</span>
      {section.unread && (
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-foreground" />
      )}
    </button>
  )
}

/**
 * The module's own icon once its renderer.js is in; an empty slot of the same size until then, so
 * the generic icon never flashes; the generic one for a module without its own.
 */
function ModuleIcon({ module }: { module: ModuleSummary }): React.JSX.Element {
  const parts = useModuleParts(module)
  if (parts === undefined) return <span aria-hidden="true" className="size-4 shrink-0" />
  return parts?.icon ? <parts.icon /> : <Blocks aria-hidden="true" />
}
