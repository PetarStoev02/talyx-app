import { ErrorBoundary } from '@app/ErrorBoundary'
import { moduleInvoker } from '@features/modules/host'
import { useModuleParts } from '@features/modules/useModuleParts'
import type { ModuleSummary } from '../../../../shared/modules'

/**
 * The sidebar while a module's page is open: the module's own Sidebar, or the roster when it has
 * none. The roster stays mounted under the module's sidebar: it polls the bots, so the Agents
 * button keeps showing new replies.
 */
export function ModuleSidebar({
  module,
  roster
}: {
  module: ModuleSummary
  roster: React.ReactNode
}): React.JSX.Element {
  const Sidebar = useModuleParts(module)?.sidebar
  return (
    <>
      {Sidebar && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          <ErrorBoundary scope={`module:${module.id}:sidebar`}>
            <Sidebar invoke={moduleInvoker(module.id)} />
          </ErrorBoundary>
        </div>
      )}
      <div className={Sidebar ? 'hidden' : 'contents'}>{roster ?? <div className="flex-1" />}</div>
    </>
  )
}
