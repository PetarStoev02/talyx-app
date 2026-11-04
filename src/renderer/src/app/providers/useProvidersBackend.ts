import { useMemo } from 'react'
import type { ProvidersBackend } from '@features/providers/providers'
import { engineHttp } from '@shared/engine/http'
import { useEngine } from './useEngine'

/** The manager bot's profile: new bots copy its model and endpoint, every bot reads its sign-ins. */
const HOME_PROFILE = 'default'

/** The providers page's engine access, once the engine is attached. REST only, no socket. */
export function useProvidersBackend(): ProvidersBackend | null {
  const attached = useEngine((s) => s.status?.state === 'attached')
  return useMemo(
    () => (attached ? { http: engineHttp, home: HOME_PROFILE, profiles: listProfiles } : null),
    [attached]
  )
}

async function listProfiles(): Promise<string[]> {
  const { profiles } = await engineHttp<{ profiles: Array<{ name: string }> }>({
    path: '/api/profiles'
  })
  return profiles.map((profile) => profile.name)
}
