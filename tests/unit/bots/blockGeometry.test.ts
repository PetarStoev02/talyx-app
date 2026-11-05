import { describe, expect, it } from 'vitest'
import {
  BLOCK_HUES,
  BLOCK_SHAPES,
  blockGeometry,
  blockTones,
  frontPoint
} from '../../../src/renderer/src/shared/ui/blockGeometry'
import type { Point } from '../../../src/renderer/src/shared/ui/blockGeometry'

// Three faces per cube, less the ones two cubes share.
const SEEN_FACES = { cube: 3, tall: 5, slab: 5, stair: 7, twin: 5, tower: 7 }
const SIZES = [20, 24, 44, 64, 1024]
const TURNS = [-10, 0, 10]
// Where the face draws its eyes and mouth on the front face.
const FACE_POINTS: Array<[number, number]> = [
  [0.32, 0.6],
  [0.68, 0.6],
  [0.5, 0.22]
]

// Even-odd ray cast; a point on an edge counts as outside, which is enough for face anchors.
function inside([x, y]: Point, polygon: Point[]): boolean {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

describe('block geometry', () => {
  it('should offer six shapes and twelve hues', () => {
    expect(BLOCK_SHAPES).toEqual(['cube', 'tall', 'slab', 'stair', 'twin', 'tower'])
    expect(BLOCK_HUES).toHaveLength(12)
    expect(new Set(BLOCK_HUES).size).toBe(12)
  })

  describe.each(BLOCK_SHAPES)('the %s shape', (shape) => {
    it('should draw every point inside its box at every size and turn', () => {
      for (const size of SIZES)
        for (const yaw of TURNS) {
          const points = blockGeometry(shape, size, yaw).faces.flatMap((face) => face.points)
          for (const [x, y] of points) {
            expect(x).toBeGreaterThanOrEqual(0)
            expect(x).toBeLessThanOrEqual(size)
            expect(y).toBeGreaterThanOrEqual(0)
            expect(y).toBeLessThanOrEqual(size)
          }
        }
    })

    it('should draw its cubes back to front, leaving out faces against a neighbour', () => {
      const { faces } = blockGeometry(shape, 64, 0)
      const depths = faces.map((face) => face.depth)
      expect(depths).toEqual([...depths].sort((a, b) => a - b))
      const seen = new Set(faces.map((face) => `${face.voxel.join()}:${face.tone}`))
      expect(seen.size).toBe(faces.length)
      expect(faces.length).toBe(SEEN_FACES[shape])
    })

    it('should leave the face uncovered by anything drawn after the front face', () => {
      for (const yaw of TURNS) {
        const { faces, frontIndex } = blockGeometry(shape, 64, yaw)
        const front = faces[frontIndex].points
        const later = faces.slice(frontIndex + 1)
        for (const [u, v] of FACE_POINTS) {
          const point = frontPoint(front, u, v)
          expect(inside(point, front)).toBe(true)
          for (const face of later) expect(inside(point, face.points)).toBe(false)
        }
      }
    })
  })

  describe('blockTones', () => {
    it.each(BLOCK_HUES.map((hue, index) => [index, hue]))(
      'should give hue %i three flat steps of %i°',
      (index, hue) => {
        expect(blockTones(index, false)).toEqual({
          top: `oklch(0.9 0.07 ${hue})`,
          left: `oklch(0.7 0.13 ${hue})`,
          right: `oklch(0.52 0.13 ${hue})`,
          ink: `oklch(0.3 0.1 ${hue})`
        })
      }
    )

    it('should drop the chroma when the bot is offline', () => {
      expect(Object.values(blockTones(3, true)).every((tone) => / 0 \d+\)$/.test(tone))).toBe(true)
    })
  })
})
