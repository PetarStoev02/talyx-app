import { dayStamp, isAllDayPause, isNoticesPaused } from '../../../../shared/notices/pause'

export type KillAction = 'abort' | 'pause-notices' | 'hide' | 'noop'

export { dayStamp, isAllDayPause, isNoticesPaused }

export function resolveKillAction(input: {
  busy: boolean
  noticesEnabled: boolean
  paused: boolean
  overlayVisible?: boolean
}): KillAction {
  if (input.busy) return 'abort'
  if (input.noticesEnabled && !input.paused) return 'pause-notices'
  if (input.overlayVisible) return 'hide'
  return 'noop'
}

/** Esc / agent:hide — pause only when the overlay was a quiet push briefing. */
export function hideOverlayAndMaybePauseNotices(deps: {
  quietBriefingVisible: () => boolean
  hideOverlay: () => void
  pauseNoticesForToday: () => void
}): void {
  const pauseNotices = deps.quietBriefingVisible()
  deps.hideOverlay()
  if (pauseNotices) deps.pauseNoticesForToday()
}
