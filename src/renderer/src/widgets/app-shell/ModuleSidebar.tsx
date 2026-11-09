import { ErrorBoundary } from '@app/ErrorBoundary'
import { useLanguage } from '@app/providers/useLanguage'
import { moduleInvoker } from '@features/modules/host'
import { useModuleParts } from '@features/modules/useModuleParts'
import { Loading, SkeletonRows } from '@shared/ui/skeleton'
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
  const t = useLanguage((s) => s.t)
  const parts = useModuleParts(module)
  const Sidebar = parts?.sidebar
  // Until the module's file is in, it is not known whose sidebar this is: neither flashes.
  const loading = parts === undefined
  return (
    <>
      {loading && (
        <Loading
          label={t('modules.sidebarLoading').replace('{name}', module.name)}
          className="min-h-0 flex-1 px-3"
        >
          <SkeletonRows count={3} avatar={false} />
        </Loading>
      )}
      {Sidebar && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          <ErrorBoundary scope={`module:${module.id}:sidebar`}>
            <Sidebar invoke={moduleInvoker(module.id)} />
          </ErrorBoundary>
        </div>
      )}
      <div className={Sidebar || loading ? 'hidden' : 'contents'}>
        {roster ?? <div className="flex-1" />}
      </div>
    </>
  )
}
