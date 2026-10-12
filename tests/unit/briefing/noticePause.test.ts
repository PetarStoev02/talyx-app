import { describe, it, expect, vi } from 'vitest'
import {
  isAllDayPause,
  isNoticesPaused,
  resolveKillAction,
  hideOverlayAndMaybePauseNotices
} from '../../../src/main/domain/briefing/model/noticePause'

describe('isNoticesPaused', () => {
  it('should be false when nothing is stored', () => {
    expect(isNoticesPaused(null, new Date('2026-09-21T12:00:00'))).toBe(false)
  })

  it('should be true until the stored instant and false from it on', () => {
    const until = new Date('2026-09-22T00:00:00').toISOString()
    expect(isNoticesPaused(until, new Date('2026-09-21T23:59:00'))).toBe(true)
    expect(isNoticesPaused(until, new Date('2026-09-22T00:00:00'))).toBe(false)
  })

  it('should honour a focus pause to the minute', () => {
    const until = new Date('2026-09-22T12:00:00').toISOString()
    expect(isNoticesPaused(until, new Date('2026-09-22T11:59:00'))).toBe(true)
    expect(isNoticesPaused(until, new Date('2026-09-22T12:00:00'))).toBe(false)
  })
})

describe('isAllDayPause', () => {
  const now = new Date('2026-09-21T10:00:00')

  it('should be true for a pause that reaches the end of today', () => {
    expect(isAllDayPause(new Date('2026-09-22T00:00:00').toISOString(), now)).toBe(true)
  })

  it('should be false for a pause that ends with a meeting today', () => {
    expect(isAllDayPause(new Date('2026-09-21T12:00:00').toISOString(), now)).toBe(false)
  })

  it('should be false when nothing is stored', () => {
    expect(isAllDayPause(null, now)).toBe(false)
  })
})

describe('resolveKillAction', () => {
  it('should abort while the assistant is busy', () => {
    expect(
      resolveKillAction({ busy: true, noticesEnabled: true, paused: false, overlayVisible: true })
    ).toBe('abort')
  })

  it('should pause notices when idle, enabled, and not already paused', () => {
    expect(
      resolveKillAction({ busy: false, noticesEnabled: true, paused: false, overlayVisible: false })
    ).toBe('pause-notices')
  })

  it('should pause notices even when the overlay is visible', () => {
    expect(
      resolveKillAction({ busy: false, noticesEnabled: true, paused: false, overlayVisible: true })
    ).toBe('pause-notices')
  })

  it('should hide the overlay when notices cannot be paused', () => {
    expect(
      resolveKillAction({ busy: false, noticesEnabled: false, paused: false, overlayVisible: true })
    ).toBe('hide')
  })

  it('should no-op when there is nothing to do', () => {
    expect(
      resolveKillAction({
        busy: false,
        noticesEnabled: false,
        paused: false,
        overlayVisible: false
      })
    ).toBe('noop')
  })

  it('should not pause again when notices are already paused', () => {
    expect(
      resolveKillAction({ busy: false, noticesEnabled: true, paused: true, overlayVisible: true })
    ).toBe('hide')
  })
})

describe('hideOverlayAndMaybePauseNotices', () => {
  it('should pause after hide when a quiet briefing is showing', () => {
    const hideOverlay = vi.fn()
    const pauseNoticesForToday = vi.fn()
    hideOverlayAndMaybePauseNotices({
      quietBriefingVisible: () => true,
      hideOverlay,
      pauseNoticesForToday
    })
    expect(hideOverlay).toHaveBeenCalledOnce()
    expect(pauseNoticesForToday).toHaveBeenCalledOnce()
  })

  it('should only hide when the owner opened the overlay', () => {
    const hideOverlay = vi.fn()
    const pauseNoticesForToday = vi.fn()
    hideOverlayAndMaybePauseNotices({
      quietBriefingVisible: () => false,
      hideOverlay,
      pauseNoticesForToday
    })
    expect(hideOverlay).toHaveBeenCalledOnce()
    expect(pauseNoticesForToday).not.toHaveBeenCalled()
  })
})
