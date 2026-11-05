import { beforeEach, describe, expect, it } from 'vitest'
import { answering, roomActions } from '../../../src/renderer/src/features/chat/room'
import type { RoomActions } from '../../../src/renderer/src/features/chat/room'
import {
  attachmentKey,
  parseAttachmentKey,
  roomItems
} from '../../../src/renderer/src/features/chat/roomLog'
import { useRooms } from '../../../src/renderer/src/features/chat/roomStore'
import type { RoomEvent, RoomView } from '../../../src/renderer/src/features/chat/types'
import { t } from '../../../src/renderer/src/shared/lib/i18n'
import { ROOM, memberSession, roomDouble } from './roomDouble'
import type { ChatCall } from './chatDouble'
import type { RoomDouble } from './roomDouble'

const NAMES: Record<string, string> = {
  default: 'Talyx',
  'acme-cfo': 'Acme CFO',
  'cfo-seat': 'Acme CFO'
}
const labels = {
  // A legacy roster row may give a member an id other than its profile.
  memberOf: (member: string): { name: string; profile: string } => ({
    name: NAMES[member] ?? member,
    profile: member === 'cfo-seat' ? 'acme-cfo' : member
  }),
  t: (key: Parameters<typeof t>[0]): string => t(key, 'en')
}

let engine: RoomDouble
let actions: RoomActions

const view = (): RoomView => useRooms.getState().rooms[ROOM]
const methods = (): string[] => engine.calls.map((call) => call.method)
const sent = (): Record<string, unknown>[] =>
  engine.calls.filter((call) => call.method === 'groups.send').map((call) => call.params)
const event = (
  seq: number,
  kind: string,
  payload: Record<string, unknown> = {},
  actor: RoomEvent['actor'] = { kind: 'gateway', id: 'install' }
): RoomEvent => ({ seq, event_id: `e${seq}`, kind, actor, payload, created_at: 1 })

beforeEach(() => {
  useRooms.setState({ rooms: {} })
  engine = roomDouble([
    event(1, 'message.user', { text: 'Monthly or yearly?' }, { kind: 'user', id: 'desktop' }),
    event(2, 'message.member', { text: 'Monthly.' }, { kind: 'member', id: 'default' }),
    event(3, 'turn.settled', { member_id: 'default' })
  ])
  actions = roomActions(engine.backend)
})

describe('group room', () => {
  describe('reading', () => {
    it('should open a room with its whole history, page by page', async () => {
      await actions.refresh(ROOM)
      expect(view().events.map((item) => item.seq)).toEqual([1, 2, 3])
      expect(view()).toMatchObject({ lastSeq: 3, live: true, loading: false, error: null })
      expect(methods()).toEqual(['groups.state', 'groups.log', 'groups.log'])
    })

    it('should ask only for the rows after the last one read', async () => {
      await actions.refresh(ROOM)
      engine.memberSays('acme-cfo', 'Yearly, with a discount.')
      engine.calls.length = 0
      await actions.refresh(ROOM)
      expect(engine.calls.find((call) => call.method === 'groups.log')?.params).toMatchObject({
        since_seq: 3
      })
      expect(view().events.map((item) => item.seq)).toEqual([1, 2, 3, 4])
    })

    it('should skip the log when nothing new was written', async () => {
      await actions.refresh(ROOM)
      engine.calls.length = 0
      await actions.refresh(ROOM)
      expect(methods()).toEqual(['groups.state'])
    })

    it('should join a read already on its way instead of starting a second one', async () => {
      await Promise.all([actions.refresh(ROOM), actions.refresh(ROOM)])
      expect(methods().filter((method) => method === 'groups.state')).toHaveLength(1)
      expect(view().events).toHaveLength(3)
    })

    it('should mark a room the engine does not run as read-only', async () => {
      engine.driver = null
      await actions.refresh(ROOM)
      expect(view()).toMatchObject({ live: false, working: false, tasks: [] })
    })

    it('should show a failed read on the room', async () => {
      engine.failNext('groups.state', 'Socket closed')
      await actions.refresh(ROOM)
      expect(view()).toMatchObject({ loading: false, error: 'Socket closed' })
    })
  })

  describe('who is talking', () => {
    it('should say which members answer, by profile, and which wait their turn', async () => {
      engine.driver!.working = true
      engine.driver!.member_activity = [
        { member_id: 'acme-cfo', status: 'queued' },
        { member_id: 'acme-cfo', status: 'running' },
        { member_id: 'default', status: 'queued' }
      ]
      await actions.refresh(ROOM)
      expect(view()).toMatchObject({
        working: true,
        phases: { 'acme-cfo': 'working', default: 'queued' }
      })
      const members = [{ profile: 'acme-cfo' }, { profile: 'default' }]
      expect(answering({ members }, view().phases)).toEqual(['acme-cfo'])
      // A legacy roster row seats a member under an id other than its profile.
      const seated = [{ profile: 'acme-ops', member_id: 'acme-cfo' }]
      expect(answering({ members: seated }, view().phases)).toEqual(['acme-ops'])
      expect(answering({ members }, undefined)).toEqual([])
    })
  })

  describe('sending', () => {
    it('should post the message under a new event id that also opens its thread', async () => {
      await actions.refresh(ROOM)
      expect(await actions.send(ROOM, { text: '  Go monthly?  ', attachments: [] })).toBe(true)
      const [params] = sent()
      expect(params).toMatchObject({
        room_id: ROOM,
        payload: { text: 'Go monthly?', thread_id: params.event_id, attachments: [] }
      })
      expect(view().events.at(-1)).toMatchObject({ kind: 'message.user' })
    })

    it('should send nothing for an empty draft', async () => {
      expect(await actions.send(ROOM, { text: '   ', attachments: [] })).toBe(false)
      expect(sent()).toHaveLength(0)
    })

    it('should post a retried message once when the first answer was lost', async () => {
      await actions.refresh(ROOM)
      engine.loseNextAnswer()
      expect(await actions.send(ROOM, { text: 'Go monthly?', attachments: [] })).toBe(false)
      expect(view().actionError).toBe('Request timed out')
      expect(await actions.send(ROOM, { text: 'Go monthly?', attachments: [] })).toBe(true)
      const [first, second] = sent()
      expect(second.event_id).toBe(first.event_id)
      expect(engine.events.filter((item) => item.kind === 'message.user')).toHaveLength(2)
      expect(view()).toMatchObject({ failedSend: null, actionError: null })
    })

    it('should keep why a send failed apart from how the room reads', async () => {
      engine.failNext('groups.send', 'Room is full')
      await actions.send(ROOM, { text: 'Go monthly?', attachments: [] })
      engine.failNext('groups.state', 'Socket closed')
      await actions.refresh(ROOM)
      expect(view()).toMatchObject({ actionError: 'Room is full', error: 'Socket closed' })
      await actions.refresh(ROOM)
      expect(view()).toMatchObject({ actionError: 'Room is full', error: null })
    })

    it('should show a sent message even when a read was already on its way', async () => {
      await actions.refresh(ROOM)
      const release = engine.holdNext('groups.state')
      const polling = actions.refresh(ROOM)
      const sending = actions.send(ROOM, { text: 'Go monthly?', attachments: [] })
      release()
      await Promise.all([polling, sending])
      expect(view().events.at(-1)).toMatchObject({
        kind: 'message.user',
        payload: { text: 'Go monthly?' }
      })
    })

    it('should post a changed draft after a failure as a new message', async () => {
      engine.failNext('groups.send', 'Socket closed')
      await actions.send(ROOM, { text: 'Go monthly?', attachments: [] })
      await actions.send(ROOM, { text: 'Go yearly?', attachments: [] })
      const [first, second] = sent()
      expect(second.event_id).not.toBe(first.event_id)
    })

    it('should upload an image for the next message and read it back', async () => {
      const attachment = await actions.uploadImage(ROOM, {
        dataUrl: 'data:image/png;base64,aGVsbG8=',
        name: ' chart.png ',
        mime: 'IMAGE/PNG'
      })
      expect(attachment).toEqual({
        attachment_id: 'file-1',
        kind: 'image',
        name: 'chart.png',
        mime: 'image/png',
        size: 5
      })
      expect(engine.stored[0].data_base64).toBe('aGVsbG8=')
      expect(
        await actions.image(ROOM, { eventId: 'e1', attachmentId: attachment.attachment_id })
      ).toBe('data:image/png;base64,aGVsbG8=')
    })
  })

  describe('controls', () => {
    it('should keep why a stop failed until an action works', async () => {
      engine.failNext('groups.stop', 'Gateway busy')
      await actions.stop(ROOM)
      await actions.refresh(ROOM)
      expect(view().actionError).toBe('Gateway busy')
      await actions.stop(ROOM)
      expect(view().actionError).toBeNull()
    })

    it('should stop the room and show that it stopped', async () => {
      await actions.refresh(ROOM)
      await actions.stop(ROOM)
      const stop = engine.calls.find((call) => call.method === 'groups.stop')
      expect(stop?.params).toMatchObject({ room_id: ROOM, cancel_id: expect.any(String) })
      expect(view().events.at(-1)?.kind).toBe('room.stop_requested')
    })

    it('should answer a member approval with its exact request', async () => {
      engine.driver!.pending_actions = [
        {
          kind: 'approval',
          member_id: 'acme-cfo',
          task_id: 'task-1',
          execution_generation: 2,
          request_id: 'req-1',
          approval: { command: 'rm -rf build', description: 'Clean the build' }
        }
      ]
      await actions.refresh(ROOM)
      const [task] = view().tasks
      expect(task).toMatchObject({ kind: 'approval', command: 'rm -rf build' })
      await actions.approve(ROOM, task, 'once')
      expect(engine.calls.find((call) => call.method === 'groups.approve')?.params).toEqual({
        room_id: ROOM,
        member_id: 'acme-cfo',
        task_id: 'task-1',
        execution_generation: 2,
        request_id: 'req-1',
        choice: 'once'
      })
      expect(view().tasks).toEqual([])
    })

    it.each([
      ['retry', 'groups.retry'],
      ['discard', 'groups.discard']
    ])('should %s a stalled turn through %s', async (kind, method) => {
      engine.driver!.pending_actions = [
        { kind, member_id: 'default', task_id: 'task-2', execution_generation: 1 }
      ]
      await actions.refresh(ROOM)
      await actions.settle(ROOM, view().tasks[0])
      expect(engine.calls.find((call) => call.method === method)?.params).toMatchObject({
        member_id: 'default',
        task_id: 'task-2',
        execution_generation: 1
      })
    })

    it('should leave out actions this client cannot answer', async () => {
      engine.driver!.pending_actions = [
        { kind: 'retry', task_id: 'old-row-without-member' },
        { kind: 'approval', member_id: 'default', task_id: 't', execution_generation: 1 },
        { kind: 'peer.repair', member_id: 'default', task_id: 't', execution_generation: 1 }
      ]
      await actions.refresh(ROOM)
      expect(view().tasks).toEqual([])
    })
  })
})

describe('room model', () => {
  const MEMBERS = [{ profile: 'default' }, { profile: 'acme-cfo' }, { profile: 'acme-new' }]
  const PICK = { model: '9-route-provider', provider: 'custom' }
  const calls = (method: string): ChatCall[] =>
    engine.calls.filter((item) => item.method === method)

  beforeEach(() => {
    engine.memberSessions.default = memberSession('default', 'team-manager')
    engine.memberSessions['acme-cfo'] = memberSession('acme-cfo', 'team-advisor')
  })

  it('should read the model every member runs on, or say they differ', async () => {
    await actions.readModel(ROOM, MEMBERS)
    expect(view().models).toEqual(['team-manager', 'team-advisor'])
    engine.memberSessions.default.model = 'team-advisor'
    // A built session reports its runtime provider, a cold one the configured name: same model.
    engine.memberSessions.default.provider = 'router'
    await actions.readModel(ROOM, MEMBERS)
    expect(view().models).toEqual(['team-advisor'])
  })

  it('should have no model to show before any member has answered', async () => {
    engine.memberSessions = {}
    await actions.readModel(ROOM, MEMBERS)
    expect(view().models).toEqual([])
  })

  it('should read the members it can when one cannot be read', async () => {
    engine.failNext('session.info', 'profile_not_found')
    await actions.readModel(ROOM, MEMBERS)
    expect(view()).toMatchObject({ models: ['team-advisor'], error: null })
  })

  it('should keep the newest reading when an older one answers late', async () => {
    const release = engine.holdNext('session.info')
    const stale = actions.readModel(ROOM, MEMBERS)
    await actions.setModel(ROOM, MEMBERS, PICK)
    release()
    await stale
    expect(view().models).toEqual(['9-route-provider'])
  })

  it("should switch every idle member's room session and let go of it", async () => {
    await actions.refresh(ROOM)
    const result = await actions.setModel(ROOM, MEMBERS, PICK)
    expect(result).toEqual({ switched: ['default', 'acme-cfo'], skipped: ['acme-new'] })
    expect(engine.memberSessions.default).toMatchObject({ model: '9-route-provider' })
    expect(calls('config.set').map((item) => [item.profile, item.params])).toEqual([
      [
        'default',
        {
          session_id: 'default-room-session',
          key: 'model',
          value: '9-route-provider --provider custom'
        }
      ],
      [
        'acme-cfo',
        {
          session_id: 'acme-cfo-room-session',
          key: 'model',
          value: '9-route-provider --provider custom'
        }
      ]
    ])
    expect(calls('session.detach').map((item) => item.params)).toEqual([
      { session_id: 'default-room-session', subscription_id: 'sub-default-room-session' },
      { session_id: 'acme-cfo-room-session', subscription_id: 'sub-acme-cfo-room-session' }
    ])
    expect(view()).toMatchObject({ models: ['9-route-provider'], actionError: null })
  })

  it('should leave alone a member that is answering or waiting on you', async () => {
    engine.driver!.member_activity = [{ member_id: 'acme-cfo', status: 'running' }]
    engine.driver!.pending_actions = [
      { kind: 'retry', member_id: 'default', task_id: 't', execution_generation: 1 }
    ]
    await actions.refresh(ROOM)
    const result = await actions.setModel(ROOM, MEMBERS, PICK)
    expect(result).toEqual({ switched: [], skipped: ['default', 'acme-cfo', 'acme-new'] })
    expect(calls('session.resume')).toEqual([])
  })

  it('should not count a model the engine wants confirmed as switched', async () => {
    engine.guarded.add('9-route-provider')
    await actions.refresh(ROOM)
    const result = await actions.setModel(ROOM, MEMBERS, PICK)
    expect(result.switched).toEqual([])
    expect(view().actionError).toBe('9-route-provider costs more per turn.')
    expect(engine.memberSessions.default.model).toBe('team-manager')
    // A session opened for a refused switch is still let go of.
    expect(calls('session.detach')).toHaveLength(2)
  })

  it('should count a switched member once its model changed, even if letting go fails', async () => {
    await actions.refresh(ROOM)
    engine.failNext('session.detach', 'Socket closed')
    const result = await actions.setModel(ROOM, MEMBERS, PICK)
    expect(result.switched).toEqual(['default', 'acme-cfo'])
    expect(view().actionError).toBe('Socket closed')
  })
})

describe('room transcript', () => {
  it('should show your messages, each bot reply with its sender, and hide bookkeeping', () => {
    const items = roomItems(
      [
        event(1, 'message.user', { text: 'Plus and minus?' }, { kind: 'user', id: 'desktop' }),
        event(2, 'message.member', { text: 'Plus: cash.' }, { kind: 'member', id: 'cfo-seat' }),
        event(3, 'turn.settled', { member_id: 'acme-cfo' }),
        event(4, 'message.member', { text: 'Summary.' }, { kind: 'member', id: 'default' }),
        event(5, 'room.renamed', { name: 'Team' }),
        event(6, 'room.activity', { status: 'settled', reason_code: 'silent_round' })
      ],
      labels
    )
    expect(items).toEqual([
      { kind: 'user', id: 'e1', text: 'Plus and minus?', images: [] },
      {
        kind: 'bot',
        id: 'e2',
        text: 'Plus: cash.',
        streaming: false,
        error: null,
        sender: { name: 'Acme CFO', profile: 'acme-cfo' }
      },
      {
        kind: 'bot',
        id: 'e4',
        text: 'Summary.',
        streaming: false,
        error: null,
        sender: { name: 'Talyx', profile: 'default' }
      }
    ])
  })

  it.each([
    [
      'turn.failed',
      { member_id: 'acme-cfo', error: 'Provider down' },
      'Acme CFO’s turn failed: Provider down'
    ],
    ['turn.cancelled', { member_id: 'default' }, 'Talyx’s turn was cancelled'],
    ['turn.deferred', { member_id: 'default' }, 'Talyx’s turn stopped part way'],
    [
      'member.unavailable',
      { member_id: 'acme-cfo', reason: 'retired' },
      'Acme CFO is unavailable: retired'
    ],
    ['room.stop_requested', {}, 'The room was stopped'],
    [
      'room.activity',
      { status: 'bounded', reason_code: 'max_rounds' },
      'The bots reached the round limit'
    ],
    ['authority.lost', {}, 'This room is now run from another machine']
  ])('should show %s as one notice line', (kind, payload, text) => {
    expect(roomItems([event(1, kind, payload)], labels)).toEqual([
      { kind: 'notice', id: 'e1', text }
    ])
  })

  it('should drop a bot turn that said nothing', () => {
    const silent = event(1, 'message.member', { text: '  ' }, { kind: 'member', id: 'default' })
    expect(roomItems([silent], labels)).toEqual([])
  })

  it('should address each file of a message by event and attachment', () => {
    const file = {
      attachment_id: 'a1',
      kind: 'image',
      name: 'chart.png',
      mime: 'image/png',
      size: 5
    }
    const [item] = roomItems(
      [event(1, 'message.user', { text: '', attachments: [file, { name: 'broken' }] })],
      labels
    )
    expect(item).toMatchObject({ kind: 'user', images: ['e1/a1/image/chart.png'] })
    expect(parseAttachmentKey(attachmentKey('e1', file))).toEqual({
      eventId: 'e1',
      attachmentId: 'a1',
      kind: 'image'
    })
  })
})
