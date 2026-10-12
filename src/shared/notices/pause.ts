/** Local calendar day stamp, the key notice marks are filed under. */
export function dayStamp(now: Date): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** When today ends, in the machine's own zone — where a ⌘⇧Esc pause expires. */
export function nextLocalMidnight(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
}

/** `noticesPausedUntil` is an ISO instant; paused while now is before it. */
export function isNoticesPaused(pausedUntil: string | null, now: Date): boolean {
  return pausedUntil !== null && now.getTime() < Date.parse(pausedUntil)
}

/** A pause that outlasts today (⌘⇧Esc), as opposed to one that ends with a meeting (focus). */
export function isAllDayPause(pausedUntil: string | null, now: Date): boolean {
  return pausedUntil !== null && Date.parse(pausedUntil) >= nextLocalMidnight(now).getTime()
}
