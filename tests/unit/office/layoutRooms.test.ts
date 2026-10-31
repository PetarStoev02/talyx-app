import { describe, it, expect } from 'vitest'
import { layoutRooms } from '../../../src/main/domain/office/layoutRooms'
import type { Room } from '../../../src/main/domain/office/model'

const room = (id: string, kind: Room['kind'], groupId: string | null = null): Room => ({
  id,
  projectId: 'p1',
  name: id,
  kind,
  groupId
})

const agroOps = (): Room[] => [
  room('team-room', 'conference', 'team'),
  room('client-room', 'conference', 'client'),
  room('work', 'work'),
  room('chill', 'chill')
]

describe('layoutRooms', () => {
  it('places two conference rooms, the work room, and a full-width chill room', () => {
    expect(layoutRooms(agroOps())).toEqual([
      { roomId: 'team-room', x: 0, z: 0, w: 6, d: 5 },
      { roomId: 'client-room', x: 6, z: 0, w: 6, d: 5 },
      { roomId: 'work', x: 12, z: 0, w: 4.5, d: 5 },
      { roomId: 'chill', x: 0, z: 5, w: 16.5, d: 4 }
    ])
  })

  it('gives an extra room a slot in the back row', () => {
    const boxes = layoutRooms([...agroOps(), room('extra', 'conference')])
    const by = Object.fromEntries(boxes.map((b) => [b.roomId, b]))
    expect(by['extra']).toEqual({ roomId: 'extra', x: 12, z: 0, w: 6, d: 5 })
    expect(by['work'].x).toBe(18)
    expect(by['chill'].w).toBe(22.5)
  })
})
