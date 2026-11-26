import { useMemo } from 'react'
import { useOnUnmount } from '@shared/hooks/useSubscription'
import { ErrorBoundary } from '@shared/ui/ErrorBoundary'
import { moduleInvoker } from '@features/modules/host'
import { useModuleAttention } from '@features/modules/store'
import { useModuleParts } from '@features/modules/useModuleParts'
import type { ModuleSummary } from '@contract/modules'

/**
 * A running module's Background export, mounted whatever page is open, so the module can watch
 * for work and mark its dock button when something waits on you. Draws nothing of its own.
 */
export function ModuleBackground({ module }: { module: ModuleSummary }): React.JSX.Element | null {
  const parts = useModuleParts(module)
  const setNeedsYou = useModuleAttention((s) => s.setNeedsYou)
  const props = useMemo(
    () => ({
      invoke: moduleInvoker(module.id),
      setNeedsYou: (count: number) =>
        setNeedsYou(module.id, Number.isFinite(count) && count > 0 ? Math.floor(count) : 0)
    }),
    [module.id, setNeedsYou]
  )
  // A module that stops (or updates: ModuleBackgrounds keys this by version) leaves no dot behind.
  useOnUnmount(() => setNeedsYou(module.id, 0))
  const Background = parts?.background
  if (!Background) return null
  return (
    <ErrorBoundary scope={`module:${module.id}:background`}>
      <Background {...props} />
    </ErrorBoundary>
  )
}

/** Every running module's Background, hidden: a failed one's notice must not take layout space. */
export function ModuleBackgrounds({ modules }: { modules: ModuleSummary[] }): React.JSX.Element {
  return (
    <div hidden>
      {modules.map((module) => (
        // Keyed by version too: an update starts its Background afresh, with no dot left over.
        <ModuleBackground key={`${module.id}@${module.version}`} module={module} />
      ))}
    </div>
  )
}
