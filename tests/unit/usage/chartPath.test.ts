import { describe, expect, it } from 'vitest'
import { niceCeiling, smoothPath } from '../../../src/renderer/src/shared/lib/chartPath'

// Every coordinate a path names, as [x, y] pairs.
function coordinates(path: string): number[][] {
  const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
  return numbers.flatMap((_, i) => (i % 2 === 0 ? [[numbers[i], numbers[i + 1]]] : []))
}

describe('chart path', () => {
  describe('smoothPath', () => {
    it('should start at the first point and pass through every point', () => {
      const points = [
        [0, 100],
        [10, 20],
        [20, 60]
      ] as const

      const path = smoothPath(points.map(([x, y]) => ({ x, y })))

      expect(path.startsWith('M0,100')).toBe(true)
      for (const [x, y] of points) expect(path).toContain(`${x},${y}`)
    })

    it('should never bend past a flat run, so a quiet day stays on the baseline', () => {
      const path = smoothPath([100, 100, 0, 100, 100].map((y, x) => ({ x: x * 10, y })))

      expect(coordinates(path).every(([, y]) => y >= 0 && y <= 100)).toBe(true)
    })

    it('should draw one point as a move and nothing for none', () => {
      expect(smoothPath([{ x: 5, y: 7 }])).toBe('M5,7')
      expect(smoothPath([])).toBe('')
    })
  })

  describe('niceCeiling', () => {
    it.each([
      [0, 10],
      [3, 10],
      [7, 10],
      [4_800_000, 5_000_000],
      [5_400_000, 6_000_000],
      [1_200, 1_200],
      [500, 500],
      [26, 30]
    ])(
      'should round %i up to %i, ten at least so small counts get whole gridlines',
      (peak, ceiling) => {
        expect(niceCeiling(peak)).toBe(ceiling)
      }
    )
  })
})
