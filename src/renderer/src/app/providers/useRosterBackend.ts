import { useEffect, useMemo, useState } from 'react'
import { host } from '@shared/engine/host'
import { blockPng } from '@shared/ui/blockPng'
import type { RosterBackend } from '@features/bots/data'
import type { RoomBackend } from '@features/chat/room'
import { useRoster } from '@features/bots/store'
import { engineAccess } from '@app/engine/access'
import { engineRoomBackend } from '@app/engine/room'
import { engineRosterBackend } from '@app/engine/roster'
import { useEngine } from './useEngine'

// The open room's view reads and acts on the room through `room`.
type RosterAndRooms = RosterBackend & { room: RoomBackend }

/**
 * The roster's engine access, once the engine is attached and the socket has opened once.
 * Stable while the metadata keys stay the same, so roster polling does not restart.
 */
export function useRosterBackend(): RosterAndRooms | null {
  const status = useEngine((s) => s.status)
  const check = useEngine((s) => s.check)
  const [opened, setOpened] = useState(false)
  const botMetaKey = status?.state === 'attached' ? status.botMetaKey : null
  const botGroupsMetaKey = status?.state === 'attached' ? status.botGroupsMetaKey : null

  useEffect(() => {
    if (!useEngine.getState().status) void check()
  }, [check])
  // A request before the first open fails at once; after that, drops redial on their own.
  // While the socket is down, every bot shows as offline.
  useEffect(
    () =>
      host.onState((state) => {
        if (state === 'open') setOpened(true)
        useRoster.getState().setOnline(state === 'open')
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
}): RosterAndRooms | null {
  const { botMetaKey, botGroupsMetaKey } = keys
  if (!botMetaKey || !botGroupsMetaKey) return null
  const roster = engineRosterBackend(engineAccess, {
    botMetaKey,
    botGroupsMetaKey,
    deleteProfile: async (profile) => {
      await host.deleteProfile(profile)
    },
    avatarPng: blockPng,
    setRoomMembers: async (roomId, members) => {
      await window.api.setRoomMembers({ roomId, members })
    }
  })
  return { ...roster, room: engineRoomBackend(engineAccess) }
}
