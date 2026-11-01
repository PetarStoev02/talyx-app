import { describe, it, expect } from 'vitest'
import { timeAgo } from '../../../src/renderer/src/shared/lib/utils'

const NOW = Date.parse('2026-10-31T12:00:00Z')

describe('timeAgo', () => {
  it.each([
    ['2026-10-31T12:00:30Z', 'just now'],
    ['2026-10-31T11:59:00Z', '1 min ago'],
    ['2026-10-31T11:01:00Z', '59 min ago'],
    ['2026-10-31T11:00:00Z', '1 h ago'],
    ['2026-10-30T12:00:01Z', '23 h ago'],
    ['2026-10-29T12:00:00Z', '2 d ago']
  ])('should show %s as %s', (iso, expected) => {
    expect(timeAgo(iso, NOW)).toBe(expected)
  })
})
