import type { Room, RoomBox } from '../../../../../shared/office'

export type RoomWithBox = Room & RoomBox

export interface Seat {
  x: number
  z: number
  faceX: number
  faceZ: number
}

const TABLE_RADIUS_X = 1.75
const TABLE_RADIUS_Z = 1.2
const TABLE_START_ANGLE = 0.4
const DESK_OFFSET_X = 1.05
const FIRST_ROW_Z = 1.7
const ROW_SPACING = 1.9
const DESK_DEPTH = 0.7
const CHAIR_OFFSET = 0.65
const MIN_DESKS = 4
const CHILL_SPACING = 2
const CHILL_INSET_X = 2
const CHILL_INSET_Z = 1.3
const CHILL_ROW_SPACING = 1.2
// Chill bots look at a point far in front of them, i.e. towards the camera.
const CAMERA_FACING = 20

export function seatFor(input: {
  room: RoomWithBox
  index: number
  count: number
  deskCount: number
}): Seat {
  const { room, index, count, deskCount } = input
  if (room.kind === 'conference') return conferenceSeat(room, index, count)
  if (room.kind === 'work') return deskSeat(room, index, deskCount)
  return chillSpot(room, index)
}

export function roomCenter(room: RoomBox): { x: number; z: number } {
  return { x: room.x + room.w / 2, z: room.z + room.d / 2 }
}

/** Desks two per row from the back wall, as many rows as fit, never fewer than four desks. */
export function deskPositions(room: RoomBox): { x: number; z: number }[] {
  const rowsThatFit = Math.floor((room.d - FIRST_ROW_Z - DESK_DEPTH) / ROW_SPACING) + 1
  const count = Math.max(MIN_DESKS, rowsThatFit * 2)
  const cx = roomCenter(room).x
  return Array.from({ length: count }, (_, i) => ({
    x: cx + (i % 2 === 0 ? -DESK_OFFSET_X : DESK_OFFSET_X),
    z: room.z + FIRST_ROW_Z + Math.floor(i / 2) * ROW_SPACING
  }))
}

function conferenceSeat(room: RoomBox, index: number, count: number): Seat {
  const c = roomCenter(room)
  const angle = (index / Math.max(count, 1)) * Math.PI * 2 + TABLE_START_ANGLE
  return {
    x: c.x + Math.cos(angle) * TABLE_RADIUS_X,
    z: c.z + Math.sin(angle) * TABLE_RADIUS_Z,
    faceX: c.x,
    faceZ: c.z
  }
}

function deskSeat(room: RoomBox, index: number, deskCount: number): Seat {
  // ponytail: more workers than desks share desks; add rows/rooms if that happens in practice.
  const desk = deskPositions(room)[index % Math.max(deskCount, 1)]
  return { x: desk.x, z: desk.z + CHAIR_OFFSET, faceX: desk.x, faceZ: desk.z - 1 }
}

function chillSpot(room: RoomBox, index: number): Seat {
  const perRow = Math.max(1, Math.floor((room.w - 2 * CHILL_INSET_X) / CHILL_SPACING) + 1)
  const x = room.x + CHILL_INSET_X + (index % perRow) * CHILL_SPACING
  const z = room.z + CHILL_INSET_Z + Math.floor(index / perRow) * CHILL_ROW_SPACING
  return { x, z, faceX: x, faceZ: z + CAMERA_FACING }
}
