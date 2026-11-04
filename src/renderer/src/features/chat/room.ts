import type { ModelPick } from '@shared/ui/ModelPicker'
import { useRooms } from './roomStore'
import { changeModel, resumeForChange } from './sessionModel'
import type { MemberPhase, RoomAttachment, RoomEvent, RoomTask, RoomView } from './types'

// The engine's own page cap for `groups.log`.
const LOG_PAGE = 500

export interface RoomBackend {
  request: (profile: string, method: string, params: Record<string, unknown>) => Promise<unknown>
}

export interface RoomDraft {
  text: string
  attachments: RoomAttachment[]
}

export interface RoomActions {
  /** Read the room's state and any log rows after the last one read. A poll calls it. */
  refresh: (roomId: string) => Promise<void>
  /** False when nothing was sent; the caller keeps the draft. */
  send: (roomId: string, draft: RoomDraft) => Promise<boolean>
  stop: (roomId: string) => Promise<void>
  approve: (roomId: string, task: RoomTask, choice: 'once' | 'deny') => Promise<void>
  /** Retry a turn that stopped part way, or discard one whose outcome is unknown. */
  settle: (roomId: string, task: RoomTask) => Promise<void>
  uploadImage: (
    roomId: string,
    image: { dataUrl: string; name: string; mime: string }
  ) => Promise<RoomAttachment>
  image: (roomId: string, file: { eventId: string; attachmentId: string }) => Promise<string>
  /** Read which model the members' room sessions run on. */
  readModel: (roomId: string, members: RoomMember[]) => Promise<void>
  /** Switch every idle member's room session to one model; the rest keep theirs for now. */
  setModel: (roomId: string, members: RoomMember[], choice: ModelPick) => Promise<ModelSwitch>
}

export interface RoomMember {
  profile: string
  member_id?: string
}

/** Members by profile: switched, or skipped (answering, waiting on you, or not answered here yet). */
export interface ModelSwitch {
  switched: string[]
  skipped: string[]
}

interface DriverStatus {
  working?: boolean
  member_activity?: { member_id: string; status: string }[]
  pending_actions?: Record<string, unknown>[]
}

interface LogPage {
  events: RoomEvent[]
  cursor: number
  has_more: boolean
}

export function roomActions(backend: RoomBackend): RoomActions {
  const { update } = useRooms.getState()
  const viewOf = (roomId: string): RoomView | undefined => useRooms.getState().rooms[roomId]
  // Rooms live on the gateway, not in a profile; the default profile's socket reaches them.
  const call = <T>(method: string, params: Record<string, unknown>): Promise<T> =>
    backend.request('default', method, params) as Promise<T>
  // One read per room at a time: a send's refresh joins a poll already on its way.
  const reads = new Map<string, Promise<void>>()

  // A failed read shows on the room instead of throwing into the view.
  async function guardedRead(roomId: string): Promise<void> {
    try {
      await read(roomId)
    } catch (error) {
      update(roomId, { loading: false, error: messageOf(error) })
    }
  }

  // A failed stop, answer, retry or discard shows until an action works; polls do not clear it.
  const acting =
    <A extends unknown[]>(run: (roomId: string, ...args: A) => Promise<void>) =>
    async (roomId: string, ...args: A): Promise<void> => {
      try {
        await run(roomId, ...args)
        update(roomId, { actionError: null })
      } catch (error) {
        update(roomId, { actionError: messageOf(error) })
      }
    }

  async function read(roomId: string): Promise<void> {
    const { room, driver_status: driver } = await call<{
      room: { latest_seq?: number | null }
      driver_status?: DriverStatus | null
    }>('groups.state', { room_id: roomId })
    const from = viewOf(roomId)?.lastSeq ?? 0
    const events = (room.latest_seq ?? 0) > from ? await readLog(roomId, from) : []
    const current = viewOf(roomId)
    const known = current?.lastSeq ?? 0
    // A send's own read may have landed first; keep only what is still new.
    const fresh = events.filter((event) => event.seq > known)
    update(roomId, {
      events: fresh.length ? [...(current?.events ?? []), ...fresh] : (current?.events ?? []),
      lastSeq: Math.max(known, ...fresh.map((event) => event.seq)),
      live: !!driver,
      working: driver?.working === true,
      phases: phasesOf(driver),
      tasks: tasksOf(driver),
      loading: false,
      error: null
    })
  }

  async function readLog(roomId: string, since: number): Promise<RoomEvent[]> {
    const events: RoomEvent[] = []
    let cursor = since
    for (;;) {
      const page = await call<LogPage>('groups.log', {
        room_id: roomId,
        since_seq: cursor,
        limit: LOG_PAGE
      })
      events.push(...page.events)
      if (!page.has_more) return events
      if (page.cursor <= cursor) throw new Error('The engine returned an invalid room log.')
      cursor = page.cursor
    }
  }

  function refresh(roomId: string): Promise<void> {
    const running = reads.get(roomId)
    if (running) return running
    const started = guardedRead(roomId).finally(() => reads.delete(roomId))
    reads.set(roomId, started)
    return started
  }

  // After a change, a read already on its way asked before it and would miss it: wait it out.
  async function readAfterChange(roomId: string): Promise<void> {
    await reads.get(roomId)
    await refresh(roomId)
  }

  // A member's session in this room lives in the member's own profile, titled after the room.
  async function memberSession(roomId: string, member: RoomMember): Promise<string | null> {
    const { sessions } = (await backend.request(member.profile, 'session.list', {
      title: `Group: ${roomId}`,
      include_hidden: true,
      limit: 1
    })) as { sessions: { id: string; resolved_id?: string | null }[] }
    return sessions[0] ? sessions[0].resolved_id || sessions[0].id : null
  }

  async function readModel(roomId: string, members: RoomMember[]): Promise<RoomView['model']> {
    const models: ModelPick[] = []
    for (const member of members) {
      const sessionId = await memberSession(roomId, member)
      if (!sessionId) continue
      const info = (await backend.request(member.profile, 'session.info', {
        session_id: sessionId
      })) as { model?: string | null; provider?: string | null }
      models.push({ model: info.model ?? '', provider: info.provider ?? '' })
    }
    if (!models.length) return null
    const [first] = models
    const same = models.every(
      (item) => item.model === first.model && item.provider === first.provider
    )
    return same ? first : 'mixed'
  }

  // A member that is answering or waiting on you keeps its model: switching would fence its turn.
  async function switchMember(
    roomId: string,
    member: RoomMember,
    choice: ModelPick
  ): Promise<boolean> {
    const view = viewOf(roomId)
    const id = member.member_id ?? member.profile
    if (view?.phases[id] || view?.tasks.some((task) => task.member_id === id)) return false
    const sessionId = await memberSession(roomId, member)
    if (!sessionId) return false
    const target = { profile: member.profile, sessionId }
    const fence = await resumeForChange(backend.request, target)
    try {
      await changeModel(backend.request, { ...target, fence }, choice)
    } finally {
      // The room's driver runs this session; this window opened it only to change it.
      if (fence.subscription)
        await backend.request(member.profile, 'session.detach', {
          session_id: sessionId,
          subscription_id: fence.subscription
        })
    }
    return true
  }

  return {
    refresh,

    send: async (roomId, draft) => {
      const text = draft.text.trim()
      if (!text && !draft.attachments.length) return false
      const key = JSON.stringify([text, draft.attachments.map((item) => item.attachment_id)])
      const failed = viewOf(roomId)?.failedSend
      const eventId = failed?.draft === key ? failed.eventId : crypto.randomUUID()
      try {
        await call('groups.send', {
          room_id: roomId,
          event_id: eventId,
          payload: { text, thread_id: eventId, attachments: draft.attachments }
        })
        update(roomId, { failedSend: null, actionError: null })
      } catch (error) {
        update(roomId, { failedSend: { eventId, draft: key }, actionError: messageOf(error) })
        return false
      }
      await readAfterChange(roomId)
      return true
    },

    stop: acting(async (roomId) => {
      await call('groups.stop', { room_id: roomId, cancel_id: crypto.randomUUID() })
      await readAfterChange(roomId)
    }),

    approve: acting(async (roomId, task: RoomTask, choice: 'once' | 'deny') => {
      await call('groups.approve', {
        room_id: roomId,
        member_id: task.member_id,
        task_id: task.task_id,
        execution_generation: task.execution_generation,
        request_id: task.request_id,
        choice
      })
      await readAfterChange(roomId)
    }),

    settle: acting(async (roomId, task: RoomTask) => {
      await call(task.kind === 'discard' ? 'groups.discard' : 'groups.retry', {
        room_id: roomId,
        member_id: task.member_id,
        task_id: task.task_id,
        execution_generation: task.execution_generation
      })
      await readAfterChange(roomId)
    }),

    uploadImage: async (roomId, { dataUrl, name, mime }) => {
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

    readModel: async (roomId, members) => {
      try {
        update(roomId, { model: await readModel(roomId, members) })
      } catch (error) {
        update(roomId, { error: messageOf(error) })
      }
    },

    setModel: async (roomId, members, choice) => {
      const result: ModelSwitch = { switched: [], skipped: [] }
      let failure: string | null = null
      for (const member of members) {
        try {
          const switched = await switchMember(roomId, member, choice)
          result[switched ? 'switched' : 'skipped'].push(member.profile)
        } catch (error) {
          failure = messageOf(error)
          result.skipped.push(member.profile)
        }
      }
      update(roomId, { actionError: failure, model: await readModel(roomId, members) })
      return result
    },

    image: async (roomId, { eventId, attachmentId }) => {
      const file = await call<{ mime: string; data_base64: string }>('groups.attachment.download', {
        room_id: roomId,
        event_id: eventId,
        attachment_id: attachmentId
      })
      return `data:${file.mime};base64,${file.data_base64}`
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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
