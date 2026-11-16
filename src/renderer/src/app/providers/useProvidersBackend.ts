import { useMemo } from 'react'
import type { ProvidersBackend } from '@features/providers/providers'
import { engineAccess } from '@app/engine/access'
import { engineProvidersBackend } from '@app/engine/providers'
import { engineConfigApi } from '@shared/api/ipc'
import { useEngine } from './useEngine'

/** The providers page's engine access, once the engine is attached. REST, and main for the one config write REST cannot make; no socket. */
export function useProvidersBackend(): ProvidersBackend | null {
  const attached = useEngine((s) => s.status?.state === 'attached')
  return useMemo(
    () => (attached ? engineProvidersBackend(engineAccess, engineConfigApi) : null),
    [attached]
  )
}
