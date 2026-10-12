import { describe, it, expect } from 'vitest'
import { shouldCloseOverlayAfterAbort } from '../../src/main/infrastructure/ipc/overlayAfterAbort'

function overlay(state: { visible: boolean; focused: boolean; destroyed?: boolean }): {
  isDestroyed: () => boolean
  isVisible: () => boolean
  isFocused: () => boolean
} {
  return {
    isDestroyed: () => state.destroyed ?? false,
    isVisible: () => state.visible,
    isFocused: () => state.focused
  }
}

describe('shouldCloseOverlayAfterAbort', () => {
  it('should close an unfocused overlay left showing by an aborted approval', () => {
    expect(shouldCloseOverlayAfterAbort(true, overlay({ visible: true, focused: false }))).toBe(
      true
    )
  })

  it('should leave a focused overlay the owner is using', () => {
    expect(shouldCloseOverlayAfterAbort(true, overlay({ visible: true, focused: true }))).toBe(
      false
    )
  })

  it('should leave the overlay alone when no approval was pending', () => {
    expect(shouldCloseOverlayAfterAbort(false, overlay({ visible: true, focused: false }))).toBe(
      false
    )
  })

  it('should do nothing when the overlay is hidden, destroyed or missing', () => {
    expect(shouldCloseOverlayAfterAbort(true, overlay({ visible: false, focused: false }))).toBe(
      false
    )
    expect(
      shouldCloseOverlayAfterAbort(
        true,
        overlay({ visible: true, focused: false, destroyed: true })
      )
    ).toBe(false)
    expect(shouldCloseOverlayAfterAbort(true, null)).toBe(false)
  })
})
