import { Bot, FolderPlus, MessagesSquare, Plus } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { useRoster } from '@features/bots/store'
import { useModuleParts } from '@features/modules/useModuleParts'
import { reportError } from '@shared/lib/report'
import type { ModuleSummary } from '../../../../shared/modules'
import { addMenu } from './addMenu'
import type { AddMenu } from './addMenu'
import { useCreating } from './creating'
import type { Creating } from './creating'
import { RosterMenu } from './RosterMenu'

/**
 * The `+` in the title row: on the agents it adds a bot, a room or a folder; while a module's page
 * is open, it offers what that module makes.
 */
export function RosterAdd({ module = null }: { module?: ModuleSummary | null }): React.JSX.Element {
  return module ? <ModuleAdd module={module} /> : <AgentsAdd />
}

function AgentsAdd(): React.JSX.Element {
  return <AddButton build={useAgentsMenu()} />
}

function ModuleAdd({ module }: { module: ModuleSummary }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const parts = useModuleParts(module)
  const agents = useAgentsMenu()
  const label = t('modules.add').replace('{name}', module.name)
  return (
    <AddButton
      build={() =>
        addMenu(parts ? { create: parts.create, label } : null, agents(), (error) =>
          reportError(`module:${module.id}:create`, error)
        )
      }
    />
  )
}

function useAgentsMenu(): () => AddMenu {
  const t = useLanguage((s) => s.t)
  const setCreating = useCreating((s) => s.setCreating)
  const open = (next: Creating): void => {
    useRoster.getState().clearError()
    setCreating(next)
  }
  return () => ({
    label: t('roster.add'),
    actions: [
      { label: t('create.title'), icon: Bot, onSelect: () => open('bot') },
      { label: t('roster.newRoom'), icon: MessagesSquare, onSelect: () => open('room') },
      { label: t('roster.newFolder'), icon: FolderPlus, onSelect: () => open('folder') }
    ]
  })
}

function AddButton({ build }: { build: () => AddMenu }): React.JSX.Element {
  const saving = useRoster((state) => state.saving)
  return (
    <RosterMenu
      label={build().label}
      disabled={saving}
      icon={<Plus size={16} />}
      // A white disc on the sidebar's tone, so the one create action stands out.
      className="size-8 bg-background shadow-xs hover:bg-background/70"
      actions={() => build().actions}
    />
  )
}
