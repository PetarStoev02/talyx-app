import { useCallback } from 'react'
import { usePolling } from '@shared/hooks/usePolling'
import type { RoomActions } from './room'

// The engine sends no room events over the socket, so an open room asks for news this often.
const POLL_MS = 2000

/** Keep an open room current while the window is on screen. */
export function useRoomPolling(actions: RoomActions | null, roomId: string): void {
  const start = useCallback((): (() => void) | null => {
    if (!actions) return null
    void actions.refresh(roomId)
    return () => {
      if (document.visibilityState === 'visible') void actions.refresh(roomId)
    }
  }, [actions, roomId])
  usePolling(POLL_MS, start)
}
