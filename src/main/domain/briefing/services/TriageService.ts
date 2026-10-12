import type { Notice, NoticeKind } from '../model/Notice'
import { CONDITION_KINDS, rankOf } from '../model/noticeRank'
import type { NoticeWatcher } from './NoticeWatcher'

export type TriageItem = {
  kind: NoticeKind
  title: string
  body: string
  rank: number
  /** Optional result card from the underlying notice (agenda/disk). */
  card: Notice['cards'][number] | null
}

export type TriageResult = {
  items: TriageItem[]
  summary: string
  /** First item's card, if any — same pattern as `brief_me`. */
  card: Notice['cards'][number] | null
}

const EMPTY_SUMMARY = 'Nothing needs you right now.'
const NONEMPTY_LEAD = "Here's what needs you now:"

/**
 * Ranks live notices into one pile the owner can scan. Ignores daily delivery
 * marks — triage is on demand, not a push schedule.
 */
export class TriageService {
  constructor(private readonly watcher: NoticeWatcher) {}

  async triage(): Promise<TriageResult> {
    const notices = await this.watcher.check({ kinds: [...CONDITION_KINDS], marks: {} })
    const items = notices
      .map(toItem)
      .filter((item): item is TriageItem => item !== null)
      .sort((a, b) => a.rank - b.rank || a.kind.localeCompare(b.kind))

    if (items.length === 0) {
      return { items: [], summary: EMPTY_SUMMARY, card: null }
    }

    const lines = items.map((item, i) => `${i + 1}. **${item.title}** — ${item.body}`)
    return {
      items,
      summary: [NONEMPTY_LEAD, '', ...lines].join('\n'),
      card: items[0].card
    }
  }
}

function toItem(notice: Notice): TriageItem | null {
  const rank = rankOf(notice.kind)
  if (rank === null) return null
  return {
    kind: notice.kind,
    title: notice.title,
    body: notice.body,
    rank,
    card: notice.cards[0] ?? null
  }
}
