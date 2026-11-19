import { useCallback, useState } from 'react'
import { useLoad } from '@shared/hooks/useLoad'
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
  // The rooms by id: the roster's snapshot changes with every bot's activity, and that alone must
  // not read every room's log again while the search is open.
  const roomKey = useRoster((s) =>
    roomsOf(s.snapshot.rooms, profile)
      .map((room) => room.room_id)
      .join('\n')
  )
  const load = useCallback(
    () => (active && rooms ? readLogs(rooms, roomKey) : Promise.resolve(null)),
    [active, rooms, roomKey]
  )
  // A read counts only for the load that made it: a new one is on its way until it lands.
  const [read, setRead] = useState<(LogsRead & { load: typeof load }) | null>(null)
  useLoad(load, {
    loaded: (logs) => setRead(logs && { ...logs, load }),
    // Each room's failure is counted in the read; the read itself does not fail.
    failed: () => undefined
  })
  const current = read?.load === load ? read : null

  // No rooms to read (no engine yet): nothing is on its way.
  if (!rooms) return { logs: [], failed: 0 }
  return { logs: current?.logs ?? null, failed: current?.failed ?? 0 }
}

interface LogsRead {
  logs: RoomLog[]
  failed: number
}

// `roomKey`: the ids of the rooms to read, one per line.
async function readLogs(rooms: RoomActions, roomKey: string): Promise<LogsRead> {
  const ids = new Set(roomKey.split('\n'))
  const targets = useRoster.getState().snapshot.rooms.filter((room) => ids.has(room.room_id))
  const logs = await Promise.all(
    targets.map((room) =>
      rooms.log(room.room_id).then(
        (events) => ({ room, events: shownAsInRoom(room, events) }),
        () => null
      )
    )
  )
  const found: RoomLog[] = logs.flatMap((log) => (log ? [log] : []))
  return { logs: found, failed: logs.length - found.length }
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
