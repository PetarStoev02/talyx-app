import { useMemo } from 'react'
import { MANAGER_TITLE } from '@features/bots/roster'
import type { ManagerName } from '@features/chat/transcript'
import { useEngine } from '@features/setup/store'

/** Talyx's handle in the engine, once attached, and the name the chat shows in its place. */
export function useManagerName(): ManagerName {
  const handle = useEngine((s) => (s.status?.state === 'attached' ? s.status.managerHandle : null))
  return useMemo(() => ({ handle, name: MANAGER_TITLE }), [handle])
}
