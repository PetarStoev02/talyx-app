import { ErrorBoundary } from '@app/ErrorBoundary'
import { useLanguage } from '@app/providers/useLanguage'
import { moduleInvoker } from '@features/modules/host'
import { useModuleParts } from '@features/modules/useModuleParts'
import { Loading, SkeletonRows } from '@shared/ui/skeleton'
import type { ModuleSummary } from '../../../../shared/modules'

/**
 * The module's own sidebar while its page is open, or nothing for a module without one. It is
 * marked `data-module-sidebar`; AppShell hides the roster after it, never unmounting it, since the
 * roster polls the bots and the Agents button keeps showing new replies.
 */
export function ModuleSidebar({ module }: { module: ModuleSummary }): React.JSX.Element | null {
  const t = useLanguage((s) => s.t)
  const parts = useModuleParts(module)
  // Until the module's file is in, it is not known whose sidebar this is: neither flashes.
  if (parts === undefined)
    return (
      <div data-module-sidebar className="contents">
        <Loading
          label={t('modules.sidebarLoading').replace('{name}', module.name)}
          className="min-h-0 flex-1 px-3"
        >
          <SkeletonRows count={3} avatar={false} />
        </Loading>
      </div>
    )
  const Sidebar = parts?.sidebar
  if (!Sidebar) return null
  return (
    <div data-module-sidebar className="min-h-0 flex-1 overflow-y-auto px-3">
      <ErrorBoundary scope={`module:${module.id}:sidebar`}>
        <Sidebar invoke={moduleInvoker(module.id)} />
      </ErrorBoundary>
    </div>
  )
}
