// The room calls more than one backend makes: the room view's and Talyx's MCP tools'. Rooms
// live on the gateway, not in a profile; the default profile's socket reaches them.

export type RoomRequest = (
  profile: string,
  method: string,
  params: Record<string, unknown>
) => Promise<unknown>

// The engine's own page cap for `groups.log`.
const LOG_PAGE = 500

/** One `groups.log` page, as the engine sends it. */
interface LogPage<T> {
  events: T[]
  cursor: number
  has_more: boolean
}

/** Every log row after `since`, page by page. */
export async function readRoomLog<T>(
  request: RoomRequest,
  roomId: string,
  since: number
): Promise<T[]> {
  const events: T[] = []
  let cursor = since
  for (;;) {
    const page = (await request('default', 'groups.log', {
      room_id: roomId,
      since_seq: cursor,
      limit: LOG_PAGE
    })) as LogPage<T>
    events.push(...page.events)
    if (!page.has_more) return events
    if (page.cursor <= cursor) throw new Error('The engine returned an invalid room log.')
    cursor = page.cursor
  }
}

/**
 * Posts a message in the room as the user. `eventId` makes a retry of the same message land once;
 * the message starts its own thread.
 */
export async function sendRoomMessage(
  request: RoomRequest,
  message: { roomId: string; eventId: string; text: string; attachments: unknown[] }
): Promise<void> {
  const { roomId, eventId, text, attachments } = message
  await request('default', 'groups.send', {
    room_id: roomId,
    event_id: eventId,
    payload: { text, thread_id: eventId, attachments }
  })
}
