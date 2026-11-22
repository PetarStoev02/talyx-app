import { useMemo } from 'react'
import type { ProvidersBackend } from '@features/providers/providers'
import { engineAccess } from '@app/engine/access'
import { engineProvidersBackend } from '@app/engine/providers'
import { engineConfigApi, engineUsageApi } from '@shared/api/ipc'
import { useEngine } from '@features/setup/store'

/** The providers backend, once the engine is attached. */
export function useProvidersBackend(): ProvidersBackend | null {
  const attached = useEngine((s) => s.status?.state === 'attached')
  return useMemo(() => (attached ? providersBackend() : null), [attached])
}

/** REST, and main for what REST cannot do (a config unset, the usage plugin). */
export function providersBackend(): ProvidersBackend {
  return engineProvidersBackend(engineAccess, { ...engineConfigApi, ...engineUsageApi })
}
