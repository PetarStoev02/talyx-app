import { useMemo } from 'react'
import type { ProvidersBackend } from '@features/providers/providers'
import { engineAccess } from '@app/engine/access'
import { engineProvidersBackend } from '@app/engine/providers'
import { useEngine } from './useEngine'

/** The providers page's engine access, once the engine is attached. REST only, no socket. */
export function useProvidersBackend(): ProvidersBackend | null {
  const attached = useEngine((s) => s.status?.state === 'attached')
  return useMemo(() => (attached ? engineProvidersBackend(engineAccess) : null), [attached])
}
