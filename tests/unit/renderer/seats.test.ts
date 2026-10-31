import { describe, it, expect } from 'vitest'
import type { Room, RoomBox } from '../../../src/shared/office'
import { seatFor } from '../../../src/renderer/src/widgets/office-scene/scene/seats'

function room(kind: Room['kind'], box: Partial<RoomBox> = {}): Room & RoomBox {
  return {
    id: kind,
    projectId: 'p',
    name: kind,
    kind,
    groupId: null,
    roomId: kind,
    x: 0,
    z: 0,
    w: 6,
    d: 5,
    ...box
  }
}

describe('seatFor', () => {
  it('should spread conference seats around the table', () => {
    const conf = room('conference')
    const seats = [0, 1, 2, 3].map((index) =>
      seatFor({ room: conf, index, count: 4, deskCount: 0 })
    )
    const first = seats[0]
    expect(first.x).toBeCloseTo(3 + Math.cos(0.4) * 1.75)
    expect(first.z).toBeCloseTo(2.5 + Math.sin(0.4) * 1.2)
    for (const s of seats) {
      expect(s.faceX).toBe(3)
      expect(s.faceZ).toBe(2.5)
      // On the 1.75 x 1.2 ellipse around the table centre
      expect(((s.x - 3) / 1.75) ** 2 + ((s.z - 2.5) / 1.2) ** 2).toBeCloseTo(1)
    }
    expect(new Set(seats.map((s) => `${s.x.toFixed(3)},${s.z.toFixed(3)}`)).size).toBe(4)
  })

  it('should give each working bot its own desk', () => {
    const work = room('work', { x: 12, w: 4.5 })
    const seats = [0, 1, 2, 3].map((index) =>
      seatFor({ room: work, index, count: 4, deskCount: 4 })
    )
    expect(new Set(seats.map((s) => `${s.x},${s.z}`)).size).toBe(4)
    // Two per row, filled from the back wall
    expect(seats[0].z).toBe(seats[1].z)
    expect(seats[2].z).toBeGreaterThan(seats[0].z)
    for (const s of seats) {
      expect(s.x).toBeGreaterThan(12)
      expect(s.x).toBeLessThan(16.5)
      expect(s.faceX).toBe(s.x)
      expect(s.faceZ).toBeLessThan(s.z)
    }
  })

  it('should line chill spots up 2 units apart', () => {
    const chill = room('chill', { z: 5, w: 16, d: 4 })
    const seats = [0, 1, 2].map((index) => seatFor({ room: chill, index, count: 3, deskCount: 0 }))
    expect(seats[1].x - seats[0].x).toBe(2)
    expect(seats[2].x - seats[1].x).toBe(2)
    expect(seats[0].z).toBe(seats[2].z)
    expect(seats[0].z).toBeGreaterThan(5)
    // Chill bots face the camera (towards +z)
    expect(seats[0].faceZ).toBeGreaterThan(seats[0].z)
  })
})
