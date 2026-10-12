interface OverlayState {
  isDestroyed: () => boolean
  isVisible: () => boolean
  isFocused: () => boolean
}

/**
 * An approval raises the overlay without focusing it, so its blur handler never
 * closes it. After an abort settles that approval, an overlay still showing and
 * unfocused is an orphaned card on top of every app. A focused overlay is one
 * the owner is using; an abort with no approval pending never raised one.
 */
export function shouldCloseOverlayAfterAbort(
  hadPendingApproval: boolean,
  overlay: OverlayState | null
): boolean {
  if (!hadPendingApproval || !overlay || overlay.isDestroyed()) return false
  return overlay.isVisible() && !overlay.isFocused()
}
