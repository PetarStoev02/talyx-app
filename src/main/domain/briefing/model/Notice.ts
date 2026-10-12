import type { ResultCard } from '../../instruction/model/Capability'

export { dayStamp } from '../../../../shared/notices/pause'

/**
 * The five things Talyx is allowed to speak first about. A closed set, not a
 * string: every one of them costs the owner's attention, so adding one has to
 * be a deliberate edit here rather than a caller inventing a kind.
 */
export type NoticeKind = 'briefing' | 'disk' | 'meeting' | 'agenda' | 'clutter'

export const NOTICE_KINDS: readonly NoticeKind[] = [
  'briefing',
  'disk',
  'meeting',
  'agenda',
  'clutter'
]

/** Notices the owner only ever needs once a day, so the check itself can be skipped. */
export const DAILY_KINDS: readonly NoticeKind[] = ['briefing', 'disk', 'clutter']

export interface Notice {
  kind: NoticeKind
  /**
   * Delivered once per distinct value — the date for a daily notice, the
   * event's start for a meeting. Comparing this against the last one delivered
   * is the whole of the "do not say it twice" rule.
   */
  fingerprint: string
  /** Notification title. */
  title: string
  /** Notification body. Carries the whole point, so opening anything is optional. */
  body: string
  /** What lands in the transcript, as markdown. */
  detail: string
  cards: ResultCard[]
}
