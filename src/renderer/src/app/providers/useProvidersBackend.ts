import { useMemo } from 'react'
import type { ProvidersBackend } from '@features/providers/providers'
import { engineAccess } from '@app/engine/access'
import { engineProvidersBackend } from '@app/engine/providers'
import { engineConfigApi, engineUsageApi } from '@shared/api/ipc'
import { useEngine } from '@features/setup/useEngine'

/** The providers backend, once the engine is attached: REST, and main for what REST cannot do (a config unset, the usage plugin). */
export function useProvidersBackend(): ProvidersBackend | null {
  const attached = useEngine((s) => s.status?.state === 'attached')
  return useMemo(
    () =>
      attached
        ? engineProvidersBackend(engineAccess, { ...engineConfigApi, ...engineUsageApi })
        : null,
    [attached]
  )
}
