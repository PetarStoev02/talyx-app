import { useEffect, useMemo, useState } from 'react'
import { host } from '@shared/engine/host'
import type { RosterBackend } from '@features/bots/data'
import { useEngine } from './useEngine'

/**
 * The roster's engine access, once the engine is attached and the socket has opened once.
 * Stable while the metadata keys stay the same, so roster polling does not restart.
 */
export function useRosterBackend(): RosterBackend | null {
  const status = useEngine((s) => s.status)
  const check = useEngine((s) => s.check)
  const [opened, setOpened] = useState(false)
  const botMetaKey = status?.state === 'attached' ? status.botMetaKey : null
  const botGroupsMetaKey = status?.state === 'attached' ? status.botGroupsMetaKey : null

  useEffect(() => {
    if (!useEngine.getState().status) void check()
  }, [check])
  // A request before the first open fails at once; after that, drops redial on their own.
  useEffect(
    () =>
      host.onState((state) => {
        if (state === 'open') setOpened(true)
      }),
    []
  )

  return useMemo(
    () => (opened ? rosterBackendFor({ botMetaKey, botGroupsMetaKey }) : null),
    [opened, botMetaKey, botGroupsMetaKey]
  )
}

export function rosterBackendFor(keys: {
  botMetaKey: string | null
  botGroupsMetaKey: string | null
}): RosterBackend | null {
  const { botMetaKey, botGroupsMetaKey } = keys
  if (!botMetaKey || !botGroupsMetaKey) return null
  return {
    request: (profile, method, params) => host.request(profile, method, params),
    deleteProfile: async (profile) => {
      await host.deleteProfile(profile)
    },
    botMetaKey,
    botGroupsMetaKey
  }
}
