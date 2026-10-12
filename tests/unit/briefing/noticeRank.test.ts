import { describe, it, expect } from 'vitest'
import {
  rankOf,
  pickHighest,
  CONDITION_KINDS
} from '../../../src/main/domain/briefing/model/noticeRank'
import type { NoticeKind } from '../../../src/main/domain/briefing/model/Notice'

function item(kind: NoticeKind): { kind: NoticeKind } {
  return { kind }
}

describe('noticeRank', () => {
  describe('CONDITION_KINDS', () => {
    it('should list on-demand condition kinds in rank order', () => {
      expect(CONDITION_KINDS).toEqual(['meeting', 'agenda', 'disk', 'clutter'])
    })
  })

  describe('rankOf', () => {
    it('should rank meeting more urgent than disk', () => {
      expect(rankOf('meeting')).toBeLessThan(rankOf('disk')!)
    })

    it('should return null for briefing', () => {
      expect(rankOf('briefing')).toBeNull()
    })
  })

  describe('pickHighest', () => {
    it('should pick meeting over disk', () => {
      expect(pickHighest([item('disk'), item('meeting')])).toEqual(item('meeting'))
    })

    it('should return null for an empty list', () => {
      expect(pickHighest([])).toBeNull()
    })

    it('should ignore briefing notices', () => {
      expect(pickHighest([item('briefing'), item('disk')])).toEqual(item('disk'))
    })
  })
})
