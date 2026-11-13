import { readRoomLog, sendRoomMessage } from '@shared/engine/rooms'
import { AppError } from '@shared/lib/problem'
import type { RoomBackend } from '@features/chat/room'
import type { MemberPhase, RoomAttachment, RoomEvent, RoomTask } from '@features/chat/types'
import type { EngineAccess } from './access'

interface DriverStatus {
  working?: boolean
  member_activity?: { member_id: string; status: string }[]
  pending_actions?: Record<string, unknown>[]
}

// Main relays socket frames up to 16 MiB; the image goes as base64 inside one, with room to spare
// for the JSON around it.
const MAX_UPLOAD_CHARS = 15 * 1024 * 1024

/** A hosted room's backend over the engine. */
export function engineRoomBackend(engine: EngineAccess): RoomBackend {
  // Rooms live on the gateway, not in a profile; the default profile's socket reaches them.
  const call = <T>(method: string, params: Record<string, unknown>): Promise<T> =>
    engine.request<T>('default', method, params)
  const taskOf = (roomId: string, task: RoomTask): Record<string, unknown> => ({
    room_id: roomId,
    member_id: task.member_id,
    task_id: task.task_id,
    execution_generation: task.execution_generation
  })

  return {
    state: async (roomId) => {
      const { room, driver_status: driver } = await call<{
        room: { latest_seq?: number | null }
        driver_status?: DriverStatus | null
      }>('groups.state', { room_id: roomId })
      return {
        latestSeq: room.latest_seq ?? 0,
        live: !!driver,
        working: driver?.working === true,
        phases: phasesOf(driver),
        tasks: tasksOf(driver)
      }
    },

    log: (roomId, since) => readRoomLog<RoomEvent>(engine.request, roomId, since),

    send: (roomId, message) => sendRoomMessage(engine.request, { roomId, ...message }),

    stop: async (roomId) => {
      await call('groups.stop', { room_id: roomId, cancel_id: crypto.randomUUID() })
    },

    approve: async (roomId, task, choice) => {
      await call('groups.approve', { ...taskOf(roomId, task), request_id: task.request_id, choice })
    },

    retry: async (roomId, task) => {
      await call('groups.retry', taskOf(roomId, task))
    },

    discard: async (roomId, task) => {
      await call('groups.discard', taskOf(roomId, task))
    },

    uploadImage: async (roomId, { dataUrl, name, mime }) => {
      // The upload rides one socket frame; a bigger one would be refused and time out unseen.
      if (dataUrl.length > MAX_UPLOAD_CHARS) throw new AppError('rooms.imageTooBig')
      const stored = await call<RoomAttachment>('groups.attachment.upload', {
        room_id: roomId,
        upload_id: crypto.randomUUID(),
        kind: 'image',
        name,
        mime,
        data_base64: dataUrl.slice(dataUrl.indexOf(',') + 1)
      })
      // The engine stores a normalized name and type; the send must name the file as stored.
      return {
        attachment_id: stored.attachment_id,
        kind: stored.kind,
        name: stored.name,
        mime: stored.mime,
        size: stored.size
      }
    },

    image: async (roomId, { eventId, attachmentId }) => {
      const file = await call<{ mime: string; data_base64: string }>('groups.attachment.download', {
        room_id: roomId,
        event_id: eventId,
        attachment_id: attachmentId
      })
      return `data:${file.mime};base64,${file.data_base64}`
    },

    // A member's session in this room lives in the member's own profile, titled after the room.
    memberSession: async (profile, roomId) => {
      const { sessions } = await engine.request<{
        sessions: { id: string; resolved_id?: string | null }[]
      }>(profile, 'session.list', { title: `Group: ${roomId}`, include_hidden: true, limit: 1 })
      return sessions[0] ? sessions[0].resolved_id || sessions[0].id : null
    },

    sessionModel: async (profile, sessionId) => {
      const info = await engine.request<{ model?: string | null }>(profile, 'session.info', {
        session_id: sessionId
      })
      return info.model || null
    },

    openSession: async (profile, sessionId) => {
      const opened = await engine.request<{ session_id?: string; subscription_id?: string }>(
        profile,
        'session.resume',
        { session_id: sessionId, defer_history: true, omit_messages: true }
      )
      return {
        sessionId: opened.session_id ?? sessionId,
        subscription: opened.subscription_id || null
      }
    },

    // The engine client turns a model `config.set` into the engine's fenced model mutation, with
    // its one retry and its confirmation answer for a costly or restricted model.
    setSessionModel: async (profile, sessionId, choice) => {
      const answer = await engine.request<{ confirm_required?: boolean; confirm_message?: string }>(
        profile,
        'config.set',
        {
          session_id: sessionId,
          key: 'model',
          value: `${choice.model} --provider ${choice.provider}`
        }
      )
      return answer.confirm_required
        ? { switched: false, confirmMessage: answer.confirm_message || null }
        : { switched: true }
    },

    letGo: async (profile, sessionId, subscription) => {
      await engine.request(profile, 'session.detach', {
        session_id: sessionId,
        subscription_id: subscription
      })
    }
  }
}

// A member running (or stopping) outranks the same member still queued behind it.
function phasesOf(driver: DriverStatus | null | undefined): Record<string, MemberPhase> {
  const phases: Record<string, MemberPhase> = {}
  for (const { member_id: member, status } of driver?.member_activity ?? []) {
    if (status !== 'queued') phases[member] = 'working'
    else phases[member] ??= 'queued'
  }
  return phases
}

// Only actions this client can answer: an approval names its request, a retry or discard its
// member and generation (older rows without them are skipped).
function tasksOf(driver: DriverStatus | null | undefined): RoomTask[] {
  return (driver?.pending_actions ?? []).flatMap((action): RoomTask[] => {
    const kind = action.kind
    const approval = (action.approval ?? {}) as Record<string, unknown>
    if (kind !== 'approval' && kind !== 'retry' && kind !== 'discard') return []
    if (typeof action.member_id !== 'string' || typeof action.task_id !== 'string') return []
    if (typeof action.execution_generation !== 'number') return []
    if (kind === 'approval' && typeof action.request_id !== 'string') return []
    return [
      {
        kind,
        member_id: action.member_id,
        task_id: action.task_id,
        execution_generation: action.execution_generation,
        request_id: typeof action.request_id === 'string' ? action.request_id : null,
        command: typeof approval.command === 'string' ? approval.command : '',
        description: typeof approval.description === 'string' ? approval.description : ''
      }
    ]
  })
}
