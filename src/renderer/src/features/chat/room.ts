import type { ModelPick } from '@shared/ui/ModelPicker'
import { replyFinished } from './completionSound'
import { useRooms } from './roomStore'
import type { TranslationKey } from '@shared/lib/i18n'
import { failureOf } from '@shared/lib/problem'
import type { Problem } from '@shared/lib/problem'
import { sameJson } from '@shared/lib/utils'
import type { MemberPhase, RoomAttachment, RoomEvent, RoomTask, RoomView } from './types'

/** A hosted room's backend. Rooms live on the engine; each member's room session in its profile. */
export interface RoomBackend {
  state: (roomId: string) => Promise<RoomState>
  /** Every log row after `since`. */
  log: (roomId: string, since: number) => Promise<RoomEvent[]>
  /** Posts as the user; the same `eventId` again lands the message once. */
  send: (
    roomId: string,
    message: { eventId: string; text: string; attachments: RoomAttachment[] }
  ) => Promise<void>
  stop: (roomId: string) => Promise<void>
  approve: (roomId: string, task: RoomTask, choice: 'once' | 'deny') => Promise<void>
  retry: (roomId: string, task: RoomTask) => Promise<void>
  discard: (roomId: string, task: RoomTask) => Promise<void>
  /** Stores an image for a send; the send names the file as stored. */
  uploadImage: (
    roomId: string,
    image: { dataUrl: string; name: string; mime: string }
  ) => Promise<RoomAttachment>
  /** A posted file as a data URL. */
  image: (roomId: string, file: { eventId: string; attachmentId: string }) => Promise<string>
  /** The member's session in this room, or null before it first answers there. */
  memberSession: (roomId: string, profile: string) => Promise<string | null>
  /** The model a session runs on, or null when it does not say. */
  sessionModel: (profile: string, sessionId: string) => Promise<string | null>
  /** Opens a session in this window, to change it; `subscription` is what to let go of after. */
  openSession: (
    profile: string,
    sessionId: string
  ) => Promise<{ sessionId: string; subscription: string | null }>
  setSessionModel: (profile: string, sessionId: string, choice: ModelPick) => Promise<ModelChange>
  /** Lets go of a session this window opened. */
  letGo: (profile: string, sessionId: string, subscription: string) => Promise<void>
}

/** What a poll reads of a room: its newest log row and, while the engine runs it, its rounds. */
export interface RoomState {
  latestSeq: number
  /** Whether the engine is running the room. */
  live: boolean
  working: boolean
  phases: Record<string, MemberPhase>
  tasks: RoomTask[]
}

/** A model switch; a costly or restricted model asks for a yes first, with why (when it says). */
export type ModelChange = { switched: true } | { switched: false; confirmMessage: string | null }

export interface RoomDraft {
  text: string
  attachments: RoomAttachment[]
}

export interface RoomActions {
  /** Read the room's state and any log rows after the last one read. A poll calls it. */
  refresh: (roomId: string) => Promise<void>
  /** The room's whole log, for a search; the open room's view is left as it is. */
  log: (roomId: string) => Promise<RoomEvent[]>
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

export function roomActions(backend: RoomBackend): RoomActions {
  const { update } = useRooms.getState()
  const viewOf = (roomId: string): RoomView | undefined => useRooms.getState().rooms[roomId]
  // One read per room at a time: a send's refresh joins a poll already on its way.
  const reads = new Map<string, Promise<void>>()
  // The newest model reading per room; an older one that answers later is dropped.
  const modelReads = new Map<string, number>()

  // A failed read shows on the room instead of throwing into the view.
  async function guardedRead(roomId: string): Promise<void> {
    try {
      await read(roomId)
    } catch (error) {
      update(roomId, { loading: false, error: failureOf('rooms.errorLoad', error) })
    }
  }

  // A failed stop, answer, retry or discard shows until an action works; polls do not clear it.
  const acting =
    <A extends unknown[]>(
      failed: TranslationKey,
      run: (roomId: string, ...args: A) => Promise<void>
    ) =>
    async (roomId: string, ...args: A): Promise<void> => {
      try {
        await run(roomId, ...args)
        update(roomId, { actionError: null })
      } catch (error) {
        update(roomId, { actionError: failureOf(failed, error) })
      }
    }

  async function read(roomId: string): Promise<void> {
    const state = await backend.state(roomId)
    const from = viewOf(roomId)?.lastSeq ?? 0
    const events = state.latestSeq > from ? await backend.log(roomId, from) : []
    const current = viewOf(roomId)
    const known = current?.lastSeq ?? 0
    // A send's own read may have landed first; keep only what is still new.
    const fresh = events.filter((event) => event.seq > known)
    // Log rows are final, so each member message is a finished reply; the first read is history.
    if (known > 0 && fresh.some((event) => event.kind === 'message.member')) replyFinished()
    const { phases, tasks } = state
    const next = {
      live: state.live,
      working: state.working,
      // Unchanged rounds and tasks keep their objects, so the room does not redraw for them.
      phases: current && sameJson(current.phases, phases) ? current.phases : phases,
      tasks: current && sameJson(current.tasks, tasks) ? current.tasks : tasks,
      loading: false,
      error: null
    }
    // A poll with nothing new leaves the view alone.
    if (
      current &&
      fresh.length === 0 &&
      (Object.keys(next) as Array<keyof typeof next>).every((key) => current[key] === next[key])
    )
      return
    update(roomId, {
      ...next,
      events: fresh.length ? [...(current?.events ?? []), ...fresh] : (current?.events ?? []),
      lastSeq: Math.max(known, ...fresh.map((event) => event.seq))
    })
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

  // A member that cannot be read (a gone profile, a bot on another machine) is left out.
  async function readMemberModel(roomId: string, member: RoomMember): Promise<string | null> {
    try {
      const sessionId = await backend.memberSession(roomId, member.profile)
      if (!sessionId) return null
      return await backend.sessionModel(member.profile, sessionId)
    } catch (error) {
      console.warn(`Room ${roomId}: could not read ${member.profile}'s model`, messageOf(error))
      return null
    }
  }

  // Only the newest reading lands: one that answers after a later switch would show a stale model.
  async function readModel(roomId: string, members: RoomMember[]): Promise<void> {
    const token = (modelReads.get(roomId) ?? 0) + 1
    modelReads.set(roomId, token)
    const models: string[] = []
    for (const member of members) {
      const model = await readMemberModel(roomId, member)
      if (model) models.push(model)
    }
    if (modelReads.get(roomId) !== token) return
    // Model names only: a built session reports its runtime provider, a cold one the configured name.
    update(roomId, { models: [...new Set(models)] })
  }

  // A member that is answering or waiting on you is skipped: the engine would hold the pick for
  // its next turn, and a held pick that needs confirming would ask a window that has let go.
  async function switchMember(
    roomId: string,
    member: RoomMember,
    choice: ModelPick
  ): Promise<{ switched: boolean; problem: Problem | null }> {
    const view = viewOf(roomId)
    const id = member.member_id ?? member.profile
    if (view?.phases[id] || view?.tasks.some((task) => task.member_id === id))
      return { switched: false, problem: null }
    const found = await backend.memberSession(roomId, member.profile)
    if (!found) return { switched: false, problem: null }
    const opened = await backend.openSession(member.profile, found)
    const session = { profile: member.profile, sessionId: opened.sessionId }
    const outcome = await changeModel(session, choice)
    const problem = opened.subscription ? await letGo(session, opened.subscription) : null
    return { switched: outcome.switched, problem: outcome.problem ?? problem }
  }

  async function changeModel(
    session: { profile: string; sessionId: string },
    choice: ModelPick
  ): Promise<{ switched: boolean; problem: Problem | null }> {
    try {
      const change = await backend.setSessionModel(session.profile, session.sessionId, choice)
      // A costly or restricted model asks for a yes that a room's switch cannot give.
      return change.switched
        ? { switched: true, problem: null }
        : {
            switched: false,
            problem: { key: 'rooms.modelNeedsConfirm', detail: change.confirmMessage }
          }
    } catch (error) {
      return { switched: false, problem: failureOf('rooms.errorModel', error) }
    }
  }

  // The room's driver runs this session; this window opened it only to change it.
  async function letGo(
    session: { profile: string; sessionId: string },
    subscription: string
  ): Promise<Problem | null> {
    try {
      await backend.letGo(session.profile, session.sessionId, subscription)
      return null
    } catch (error) {
      return failureOf('rooms.errorModel', error)
    }
  }

  return {
    refresh,

    log: (roomId) => backend.log(roomId, 0),

    send: async (roomId, draft) => {
      const text = draft.text.trim()
      if (!text && !draft.attachments.length) return false
      const key = JSON.stringify([text, draft.attachments.map((item) => item.attachment_id)])
      const failed = viewOf(roomId)?.failedSend
      const eventId = failed?.draft === key ? failed.eventId : crypto.randomUUID()
      try {
        await backend.send(roomId, { eventId, text, attachments: draft.attachments })
        update(roomId, { failedSend: null, actionError: null })
      } catch (error) {
        update(roomId, {
          failedSend: { eventId, draft: key },
          actionError: failureOf('rooms.errorSend', error)
        })
        return false
      }
      await readAfterChange(roomId)
      return true
    },

    stop: acting('rooms.errorStop', async (roomId) => {
      await backend.stop(roomId)
      await readAfterChange(roomId)
    }),

    approve: acting(
      'rooms.errorAnswer',
      async (roomId, task: RoomTask, choice: 'once' | 'deny') => {
        await backend.approve(roomId, task, choice)
        await readAfterChange(roomId)
      }
    ),

    settle: acting('rooms.errorSettle', async (roomId, task: RoomTask) => {
      await (task.kind === 'discard' ? backend.discard : backend.retry)(roomId, task)
      await readAfterChange(roomId)
    }),

    uploadImage: backend.uploadImage,

    readModel,

    setModel: async (roomId, members, choice) => {
      const result: ModelSwitch = { switched: [], skipped: [] }
      let failure: Problem | null = null
      for (const member of members) {
        try {
          const { switched, problem } = await switchMember(roomId, member, choice)
          result[switched ? 'switched' : 'skipped'].push(member.profile)
          failure = problem ?? failure
        } catch (error) {
          failure = failureOf('rooms.errorModel', error)
          result.skipped.push(member.profile)
        }
      }
      update(roomId, { actionError: failure })
      await readModel(roomId, members)
      return result
    },

    image: backend.image
  }
}

/** The profiles answering in a room right now, by the members' phases from its last poll. */
export function answering(
  room: { members: RoomMember[] },
  phases: Record<string, MemberPhase> | undefined
): string[] {
  return room.members
    .filter((member) => phases?.[member.member_id ?? member.profile] === 'working')
    .map((member) => member.profile)
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
