import type { RoomBackend } from '../../../src/renderer/src/features/chat/room'
import type { RoomEvent } from '../../../src/renderer/src/features/chat/types'
import type { ChatCall } from './chatDouble'

export interface DriverDouble {
  working: boolean
  member_activity: { member_id: string; status: string }[]
  pending_actions: Record<string, unknown>[]
}

export interface RoomDouble {
  backend: RoomBackend
  calls: ChatCall[]
  events: RoomEvent[]
  // null: the engine is not running rooms, so state carries no driver.
  driver: DriverDouble | null
  stored: { name: string; mime: string; data_base64: string }[]
  memberSays: (member: string, text: string) => void
  failNext: (method: string, message: string) => void
  // The next send lands in the log, but its answer is lost on the way back.
  loseNextAnswer: () => void
}

export const ROOM = 'team-room'
// The engine pages by bytes too; two rows a page makes paging show in small tests.
const PAGE_ROWS = 2

// In-memory hosted room: state, a paged log, send (idempotent per event id) and the controls.
export function roomDouble(events: RoomEvent[] = []): RoomDouble {
  const calls: ChatCall[] = []
  const failures = new Map<string, string>()
  const stored: RoomDouble['stored'] = []
  let lostAnswer = false
  const double: RoomDouble = {
    backend: { request: async (profile, method, params) => answer(profile, method, params) },
    calls,
    events,
    driver: { working: false, member_activity: [], pending_actions: [] },
    stored,
    memberSays: (member, text) =>
      append('message.member', { kind: 'member', id: member }, { text, member_id: member }),
    failNext: (method, message) => failures.set(method, message),
    loseNextAnswer: () => {
      lostAnswer = true
    }
  }

  function append(
    kind: string,
    actor: RoomEvent['actor'],
    payload: Record<string, unknown>,
    eventId = `${kind}-${events.length + 1}`
  ): RoomEvent {
    const event = { seq: events.length + 1, event_id: eventId, kind, actor, payload, created_at: 1 }
    events.push(event)
    return event
  }

  function answer(profile: string, method: string, params: Record<string, unknown>): unknown {
    calls.push({ profile, method, params })
    const failure = failures.get(method)
    if (failure) {
      failures.delete(method)
      throw new Error(failure)
    }
    switch (method) {
      case 'groups.state':
        return {
          room: { room_id: params.room_id, latest_seq: events.length },
          ...(double.driver ? { driver_status: structuredClone(double.driver) } : {})
        }
      case 'groups.log': {
        const since = Number(params.since_seq)
        const page = events.filter((event) => event.seq > since).slice(0, PAGE_ROWS)
        const cursor = page.at(-1)?.seq ?? since
        return { events: structuredClone(page), cursor, has_more: cursor < events.length }
      }
      case 'groups.send': {
        const eventId = `user:${String(params.event_id)}`
        const existing = events.find((event) => event.event_id === eventId)
        const event =
          existing ??
          append('message.user', { kind: 'user', id: 'desktop' }, params.payload as never, eventId)
        if (lostAnswer) {
          lostAnswer = false
          throw new Error('Request timed out')
        }
        return { event, accepted: true }
      }
      case 'groups.stop':
        append('room.stop_requested', { kind: 'system', id: 'room-control' }, {})
        return { cancelled: 1 }
      case 'groups.approve':
      case 'groups.retry':
      case 'groups.discard':
        if (double.driver) double.driver.pending_actions = []
        return { task: {} }
      case 'groups.attachment.upload':
        stored.push({
          name: String(params.name),
          mime: String(params.mime),
          data_base64: String(params.data_base64)
        })
        return { attachment_id: `file-${stored.length}`, name: params.name, mime: params.mime }
      case 'groups.attachment.download': {
        const file = stored[Number(String(params.attachment_id).replace('file-', '')) - 1]
        if (!file) throw new Error('Attachment not found')
        return file
      }
      default:
        throw new Error(`Unexpected method ${method}`)
    }
  }

  return double
}
