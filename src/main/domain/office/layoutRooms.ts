import type { Room, RoomBox } from './model'

const CONFERENCE_WIDTH = 6
const WORK_WIDTH = 4.5
const BACK_DEPTH = 5
const CHILL_DEPTH = 4

export function layoutRooms(rooms: Room[]): RoomBox[] {
  const conferences = rooms.filter((r) => r.kind === 'conference')
  const ordered = [
    ...conferences.filter((r) => r.groupId),
    ...conferences.filter((r) => !r.groupId)
  ]
  const backRow = [...ordered, ...rooms.filter((r) => r.kind === 'work')]

  let x = 0
  const boxes: RoomBox[] = backRow.map((room) => {
    const w = room.kind === 'work' ? WORK_WIDTH : CONFERENCE_WIDTH
    const box = { roomId: room.id, x, z: 0, w, d: BACK_DEPTH }
    x += w
    return box
  })
  const chill = rooms.find((r) => r.kind === 'chill')
  if (chill) boxes.push({ roomId: chill.id, x: 0, z: BACK_DEPTH, w: x, d: CHILL_DEPTH })
  return boxes
}
