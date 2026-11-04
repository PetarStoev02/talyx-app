import { useEffect } from 'react'
import type { RoomActions } from './room'

// The engine sends no room events over the socket, so an open room asks for news this often.
const POLL_MS = 2000

/** Keep an open room current while the window is on screen. */
export function useRoomPolling(actions: RoomActions | null, roomId: string): void {
  useEffect(() => {
    if (!actions) return
    void actions.refresh(roomId)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void actions.refresh(roomId)
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [actions, roomId])
}
