import { Notification } from 'electron'
import type { OverlayEvent } from '../../domain/agent/AgentSession'
import type { Notice } from '../../domain/briefing/model/Notice'

export interface NoticeDeliveryDeps {
  /** The assistant's own event fan-out: transcript, voice, both windows, dev bridge. */
  push(events: OverlayEvent[]): void
  /** Brings the overlay up without taking the keyboard. */
  showQuietly(): void
  /** Brings the overlay up and focuses it, for when the owner clicked the notification. */
  show(): void
}

/**
 * macOS will not show anything until the owner has allowed notifications for
 * Talyx, and the only way to raise that prompt is to post one. Posted the
 * moment notices are switched on, so the question arrives while the owner is
 * looking at the switch they just flipped rather than days later, attached to a
 * briefing they never see.
 *
 * The answer does not reach a process that is already running — macOS hands the
 * authorization to the next launch — which is why the copy beside the switch
 * says to restart.
 */
export function announceNotices(): void {
  if (!Notification.isSupported()) return
  new Notification({
    title: 'Notices are on',
    body: 'This is what one looks like. Talyx will only speak first when something needs you.'
  }).show()
}

/**
 * Puts a notice in front of the owner. The notification body carries the whole
 * point, so the transcript and the overlay are always optional detail rather
 * than the only place the information exists.
 */
export function noticeDelivery(deps: NoticeDeliveryDeps): (notice: Notice) => Promise<void> {
  return async (notice) => {
    // Notified first, on purpose. An unmarked notice is retried next tick, and
    // pushing the transcript entries before the step that can fail would leave
    // the owner reading the same briefing twice.
    if (Notification.isSupported()) {
      const notification = new Notification({ title: notice.title, body: notice.body })
      notification.on('click', () => deps.show())
      notification.show()
    }

    deps.push([
      ...notice.cards.map((card) => ({ type: 'card' as const, card })),
      { type: 'text' as const, text: notice.detail, interim: false }
    ])

    // Only the briefing takes the screen. A condition notice is one line; making
    // a window appear for it would cost more attention than the line is worth.
    if (notice.kind === 'briefing') deps.showQuietly()
  }
}
