import { useEffect, useMemo } from 'react'
import { ErrorBoundary } from '@app/ErrorBoundary'
import { moduleInvoker } from '@features/modules/host'
import { useModuleAttention } from '@features/modules/store'
import { useModuleParts } from '@features/modules/useModuleParts'
import type { ModuleSummary } from '../../../../shared/modules'

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
  // A module that stops (or updates) leaves no dot behind.
  useEffect(() => () => setNeedsYou(module.id, 0), [module.id, module.version, setNeedsYou])
  const Background = parts?.background
  if (!Background) return null
  return (
    <ErrorBoundary scope={`module:${module.id}:background`}>
      <Background {...props} />
    </ErrorBoundary>
  )
}
