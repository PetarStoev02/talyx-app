import { describe, it, expect } from 'vitest'
import type { OfficeSnapshot } from '../../../src/shared/office'
import { roomCounts } from '../../../src/renderer/src/widgets/office-hud/roomCounts'

type SnapshotRoom = OfficeSnapshot['rooms'][number]
type SnapshotBot = OfficeSnapshot['bots'][number]

function room(id: string, name: string, kind: SnapshotRoom['kind'] = 'work'): SnapshotRoom {
  return {
    id,
    projectId: 'p',
    name,
    kind,
    groupId: kind === 'work' ? null : 'g1',
    roomId: id,
    x: 0,
    z: 0,
    w: 4,
    d: 4
  }
}

function bot(id: string, roomId: string): SnapshotBot {
  return {
    id,
    projectId: 'p',
    name: id,
    color: '#fff',
    groupIds: [],
    webhookUrl: null,
    t3ProjectIds: [],
    grokLink: null,
    webhookReady: false,
    placement: {
      botId: id,
      roomId,
      task: null,
      t3ThreadId: null,
      t3Link: null,
      waiting: false,
      stale: false,
      lastSeenAt: null,
      lastLine: null
    }
  }
}

function snapshot(rooms: SnapshotRoom[], bots: SnapshotBot[]): OfficeSnapshot {
  const project = { id: 'p', name: 'P', logoPath: null, windowView: 'none' as const }
  return {
    project,
    projects: [project],
    rooms,
    bots,
    groups: [],
    feed: [],
    t3Connected: false,
    funnel: { on: false, url: null }
  }
}

describe('roomCounts', () => {
  it('counts bots per room in layout order', () => {
    const rooms = [room('team', 'Team conference'), room('work', 'Work room')]
    const bots = [bot('a', 'work'), bot('b', 'team'), bot('c', 'work')]
    expect(roomCounts(snapshot(rooms, bots))).toEqual([
      { roomId: 'team', name: 'Team conference', count: 1, groupId: null },
      { roomId: 'work', name: 'Work room', count: 2, groupId: null }
    ])
  })

  it('counts zero for an empty room', () => {
    const rooms = [room('chill', 'Chill room'), room('work', 'Work room')]
    expect(roomCounts(snapshot(rooms, [bot('a', 'work')]))[0]).toEqual({
      roomId: 'chill',
      name: 'Chill room',
      count: 0,
      groupId: null
    })
  })

  it('gives only a conference room its group', () => {
    const rooms = [room('team', 'Team conference', 'conference'), room('chill', 'Chill', 'chill')]
    expect(roomCounts(snapshot(rooms, [])).map((r) => r.groupId)).toEqual(['g1', null])
  })
})
