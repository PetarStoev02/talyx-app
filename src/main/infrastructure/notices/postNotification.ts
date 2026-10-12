import { Notification } from 'electron'
import log from 'electron-log'

export interface NotificationContent {
  title: string
  body: string
}

// Electron drops a notification, and its events, once it is garbage collected, and
// macOS reports `failed` and `click` asynchronously. Hold each one until it ends.
// ponytail: 'close' is not guaranteed on macOS, so some stay held for the session
// (small objects; cap the set if a watch folder ever floods it).
const live = new Set<Notification>()

/**
 * Since Electron 42 macOS delivers notifications through UNUserNotificationCenter,
 * which shows nothing for an app it does not trust or that the owner has not
 * allowed, and says so only through a `failed` event. Talyx ships ad-hoc signed,
 * so the reason has to reach the log. The content is never logged: a notice body
 * can quote the owner's mail or calendar.
 */
export function postNotification(content: NotificationContent, onClick?: () => void): void {
  if (!Notification.isSupported()) return
  const notification = new Notification(content)
  live.add(notification)
  notification.on('close', () => live.delete(notification))
  notification.on('failed', (_event, error) => {
    live.delete(notification)
    log.warn(`[Notification] not delivered: ${error}`)
  })
  if (onClick) notification.on('click', onClick)
  notification.show()
}
