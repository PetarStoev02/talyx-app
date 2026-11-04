// Deliberately in-memory: hosted rooms whose members answer in turn. Words in your message pick
// the script: "approve" makes the first member ask to run a command, "stall" leaves a turn to
// retry, "fail" fails a turn; anything else gets one reply per member, a few seconds apart.
const REPLY_MS = 1500

interface Member {
  member_id: string
  profile: string
  display_name: string
}

interface FixtureRoom {
  room_id: string
  name: string
  members: Member[]
  events: Record<string, unknown>[]
  // A room the engine does not run: readable, not sendable.
  live: boolean
  activity: { member_id: string; status: string }[]
  actions: Record<string, unknown>[]
}

const files: Record<string, { mime: string; data_base64: string }> = {}
const member = (profile: string, name: string): Member => ({
  member_id: profile,
  profile,
  display_name: name
})
const rooms: FixtureRoom[] = [
  {
    room_id: 'team-room',
    name: 'Team discussion',
    members: [member('default', 'Talyx'), member('analyst', 'Analyst'), member('writer', 'Writer')],
    events: [],
    live: true,
    activity: [],
    actions: []
  },
  {
    room_id: 'clients-room',
    name: 'Clients discussion',
    members: [member('support', 'Support'), member('sales', 'Sales')],
    events: [],
    live: true,
    activity: [],
    actions: []
  },
  {
    room_id: 'archive-room',
    name: 'Archived plans',
    members: [member('planner', 'Planner'), member('analyst', 'Analyst')],
    events: [],
    live: false,
    activity: [],
    actions: []
  }
]
append(rooms[0], 'message.user', 'desktop', { text: 'Should we move clients to monthly billing?' })
append(rooms[0], 'message.member', 'analyst', {
  text: '**Plus:** steadier cash.\n\n**Minus:** monthly revenue drops 18% against the yearly advance.'
})
append(rooms[0], 'turn.settled', 'gateway', { member_id: 'analyst' })
append(rooms[0], 'message.member', 'writer', {
  text: 'Small farms have asked for it since spring.'
})
append(rooms[0], 'message.member', 'default', {
  text: 'Summary: monthly with a winter pause; yearly keeps its 15% discount.'
})
append(rooms[2], 'message.user', 'desktop', { text: 'Plan the 2025 season.' })
append(rooms[2], 'message.member', 'planner', { text: 'Done, see the shared sheet.' })

export function roomRequest(method: string, params: Record<string, unknown>): unknown {
  const room = rooms.find((item) => item.room_id === params.room_id)
  switch (method) {
    case 'groups.list':
      return {
        rooms: rooms.map(({ room_id, name, members, events }) => ({
          room_id,
          name,
          members,
          latest_seq: events.length
        })),
        next_offset: null
      }
    case 'groups.capabilities':
      return { seatable_profiles: null }
    case 'groups.create':
      rooms.push({
        room_id: String(params.room_id),
        name: String(params.name),
        members: params.members as Member[],
        events: [],
        live: true,
        activity: [],
        actions: []
      })
      return { room: params }
  }
  if (!room) throw new Error('Room not found')
  switch (method) {
    case 'groups.state':
      return {
        room: { room_id: room.room_id, latest_seq: room.events.length },
        ...(room.live
          ? {
              driver_status: {
                working: room.activity.length > 0,
                member_activity: room.activity,
                pending_actions: room.actions
              }
            }
          : {})
      }
    case 'groups.log': {
      const since = Number(params.since_seq)
      const events = room.events.slice(since)
      return { events, cursor: room.events.length, has_more: false }
    }
    case 'groups.send': {
      const eventId = `user:${String(params.event_id)}`
      if (!room.events.some((event) => event.event_id === eventId)) {
        append(room, 'message.user', 'desktop', params.payload as Record<string, unknown>, eventId)
        answer(room, String((params.payload as { text?: string }).text ?? ''))
      }
      return { event: room.events.at(-1), accepted: true }
    }
    case 'groups.stop':
      room.activity = []
      append(room, 'room.stop_requested', 'room-control', {})
      return { cancelled: 1 }
    case 'groups.approve':
    case 'groups.retry':
      room.actions = []
      room.activity = []
      reply(room, room.members[0], 'Done, it ran cleanly.')
      return { task: {} }
    case 'groups.discard':
      room.actions = []
      return { task: {} }
    case 'groups.disband':
      rooms.splice(rooms.indexOf(room), 1)
      return { tombstone: { room_id: room.room_id } }
    case 'groups.attachment.upload': {
      const id = `file-${Object.keys(files).length + 1}`
      const mime = String(params.mime).toLowerCase()
      const data = String(params.data_base64)
      files[id] = { mime, data_base64: data }
      // As the engine does: the stored name is trimmed and the type lower-cased.
      return {
        attachment_id: id,
        kind: params.kind,
        name: String(params.name).trim(),
        mime,
        size: atob(data).length
      }
    }
    case 'groups.attachment.download': {
      const file = files[String(params.attachment_id)]
      if (!file) throw new Error('Attachment not found')
      return file
    }
    default:
      throw new Error('Unsupported fixture operation')
  }
}

function answer(room: FixtureRoom, text: string): void {
  const [first] = room.members
  if (/approve/i.test(text)) {
    room.activity = [{ member_id: first.member_id, status: 'running' }]
    room.actions = [
      {
        kind: 'approval',
        member_id: first.member_id,
        task_id: 'task-approve',
        execution_generation: 1,
        request_id: 'req-1',
        approval: { command: 'npm run build', description: 'Build the pricing sheet' }
      }
    ]
    return
  }
  if (/stall/i.test(text)) {
    room.actions = [
      { kind: 'retry', member_id: first.member_id, task_id: 'task-stall', execution_generation: 1 }
    ]
    return
  }
  room.activity = room.members.map((item, index) => ({
    member_id: item.member_id,
    status: index === 0 ? 'running' : 'queued'
  }))
  room.members.forEach((item, index) =>
    setTimeout(
      () => {
        if (!room.activity.length) return
        if (/fail/i.test(text) && index === 0)
          append(room, 'turn.failed', 'gateway', {
            member_id: item.member_id,
            error: 'Provider down'
          })
        else reply(room, item, `${item.display_name} here: noted, my take is below.`)
        room.activity = room.activity
          .filter((entry) => entry.member_id !== item.member_id)
          .map((entry, next) => (next === 0 ? { ...entry, status: 'running' } : entry))
      },
      REPLY_MS * (index + 1)
    )
  )
}

// Each member's session in a room, by profile and room, from its first answer on. Analyst runs on
// another model than the rest of Team discussion, so the room's model chip reads "Mixed models".
const memberSessions = new Map<string, { model: string; revision: number }>([
  ['default:team-room', { model: '9-route-provider', revision: 1 }],
  ['analyst:team-room', { model: 'paid-model', revision: 1 }],
  ['writer:team-room', { model: '9-route-provider', revision: 1 }]
])

/** Calls on members' room sessions (`Group: <room>`); null for any other session. */
export function roomSessionRequest(
  profile: string,
  method: string,
  params: Record<string, unknown>
): unknown {
  const title = typeof params.title === 'string' ? params.title : ''
  const id = String(params.session_id ?? '')
  const roomId = title.startsWith('Group: ') ? title.slice(7) : id.split('/')[1]
  const session = roomId ? memberSessions.get(`${profile}:${roomId}`) : undefined
  if (method === 'session.list' && title.startsWith('Group: '))
    return { sessions: session ? [{ id: `${profile}/${roomId}` }] : [] }
  if (!session || !id.includes('/')) return null
  if (method === 'session.info') return { model: session.model, provider: 'custom' }
  if (method === 'session.resume')
    return { session_id: id, revision: session.revision, subscription_id: `sub-${id}` }
  if (method === 'config.set' && params.key === 'model') {
    session.model = String(params.value).split(' --provider ')[0]
    session.revision++
    return { key: 'model', value: session.model }
  }
  if (method === 'session.detach') return { detached: true }
  return null
}

function reply(room: FixtureRoom, from: Member, text: string): void {
  if (!memberSessions.has(`${from.profile}:${room.room_id}`))
    memberSessions.set(`${from.profile}:${room.room_id}`, {
      model: '9-route-provider',
      revision: 1
    })
  append(room, 'message.member', from.member_id, { text, member_id: from.member_id })
  append(room, 'turn.settled', 'gateway', { member_id: from.member_id })
}

function append(
  room: FixtureRoom,
  kind: string,
  actor: string,
  payload: Record<string, unknown>,
  eventId = `${room.room_id}-${room.events.length + 1}`
): void {
  room.events.push({
    seq: room.events.length + 1,
    event_id: eventId,
    kind,
    actor: { kind: kind === 'message.member' ? 'member' : 'gateway', id: actor },
    payload,
    created_at: Date.now() / 1000
  })
}
