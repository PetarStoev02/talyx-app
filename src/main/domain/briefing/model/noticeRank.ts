import type { NoticeKind } from './Notice'

export const CONDITION_KINDS = ['meeting', 'agenda', 'disk', 'clutter'] as const
export type ConditionKind = (typeof CONDITION_KINDS)[number]

/** Lower = more urgent; a meeting outranks clutter. */
const RANK: Record<ConditionKind, number> = {
  meeting: 1,
  agenda: 2,
  disk: 3,
  clutter: 4
}

export function rankOf(kind: NoticeKind): number | null {
  if (!(kind in RANK)) return null
  return RANK[kind as ConditionKind]
}

export function pickHighest<T extends { kind: NoticeKind }>(notices: T[]): T | null {
  let best: T | null = null
  let bestRank: number | null = null

  for (const notice of notices) {
    const rank = rankOf(notice.kind)
    if (rank === null) continue
    const wins =
      best === null ||
      bestRank === null ||
      rank < bestRank ||
      (rank === bestRank && notice.kind.localeCompare(best.kind) < 0)
    if (wins) {
      best = notice
      bestRank = rank
    }
  }

  return best
}
