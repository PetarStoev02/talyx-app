import { useEffect, useState } from 'react'
import { useRoster } from '@features/bots/store'
import { roomsOf } from '@features/chat/botSearch'
import type { RoomLog } from '@features/chat/botSearch'
import type { RoomActions } from '@features/chat/room'
import { showMentions } from '@features/chat/mentions'
import type { RoomEvent } from '@features/chat/types'
import type { Room } from '@features/bots/types'
import { roomMember, roomMentions } from './roomPeople'

/**
 * The whole log of each group chat a bot is in, read while its search is open. Null while they
 * are on their way; `failed` counts the rooms that could not be read.
 */
export function useBotRoomLogs(
  profile: string,
  rooms: RoomActions | null,
  active: boolean
): { logs: RoomLog[] | null; failed: number } {
  const [read, setRead] = useState<{ logs: RoomLog[]; failed: number } | null>(null)
  // The rooms by id: the roster's snapshot changes with every bot's activity, and that alone must
  // not read every room's log again while the search is open.
  const roomKey = useRoster((s) =>
    roomsOf(s.snapshot.rooms, profile)
      .map((room) => room.room_id)
      .join('\n')
  )

  useEffect(() => {
    if (!active || !rooms) return
    let live = true
    const targets = roomsOf(useRoster.getState().snapshot.rooms, profile)
    void Promise.all(
      targets.map((room) =>
        rooms.log(room.room_id).then(
          (events) => ({ room, events: shownAsInRoom(room, events) }),
          () => null
        )
      )
    ).then((logs) => {
      const found: RoomLog[] = logs.flatMap((log) => (log ? [log] : []))
      if (live) setRead({ logs: found, failed: logs.length - found.length })
    })
    return () => {
      live = false
      setRead(null)
    }
  }, [active, rooms, profile, roomKey])

  // No rooms to read (no engine yet): nothing is on its way.
  if (!rooms) return { logs: [], failed: 0 }
  return { logs: read?.logs ?? null, failed: read?.failed ?? 0 }
}

// Each message's text as the room shows it: @handles become the members' names.
function shownAsInRoom(room: Room, events: RoomEvent[]): RoomEvent[] {
  const bots = useRoster.getState().snapshot.bots
  const mentions = roomMentions(room, (member) => roomMember(room, bots, member))
  return events.map((event) =>
    typeof event.payload.text === 'string'
      ? {
          ...event,
          payload: { ...event.payload, text: showMentions(event.payload.text, mentions) }
        }
      : event
  )
}
