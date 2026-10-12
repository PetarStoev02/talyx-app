import { z } from 'zod/v4'
import type { Capability, Proposal } from '../model/Capability'
import type { Effect } from '../model/Effect'
import type { Notice } from '../../briefing/model/Notice'

export interface BriefingCapabilityDeps {
  compose(): Promise<Notice | null>
}

/** Counts and titles only — the same shape `today` already discloses. */
const READ_ONLY: Effect = { world: 'reads', reversible: false, discloses: 'nothing' }

/**
 * The briefing as an ability, not only as a scheduled push. It is how anyone
 * gets a briefing on a fresh install — notices ship turned off — and it is what
 * the written briefing style calls, so prose needs no second code path.
 */
export function briefingCapabilities(deps: BriefingCapabilityDeps): Capability[] {
  const briefMe: Capability<Record<string, never>> = {
    name: 'brief_me',
    description:
      'Summarise the day ahead: calendar, unread mail, disk space and what the user did yesterday',
    examples: ['brief me', "what's my day look like", 'good morning', 'catch me up'],
    params: z.object({}),
    effect: READ_ONLY,
    async plan(): Promise<Proposal> {
      const notice = await deps.compose()
      if (notice === null) {
        return { kind: 'answer', summary: 'Nothing to report this morning', evidence: [] }
      }
      return {
        kind: 'answer',
        summary: notice.detail,
        evidence: [],
        // One card per answer, and the day ahead is the one worth showing.
        ...(notice.cards.length > 0 ? { card: notice.cards[0] } : {})
      }
    }
  }

  return [briefMe as Capability]
}
