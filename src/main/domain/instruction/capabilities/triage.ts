import { z } from 'zod/v4'
import type { Capability, Proposal } from '../model/Capability'
import type { Effect } from '../model/Effect'
import type { TriageResult } from '../../briefing/services/TriageService'

export interface TriageCapabilityDeps {
  triage(): Promise<TriageResult>
}

const READ_ONLY: Effect = { world: 'reads', reversible: false, discloses: 'nothing' }

/**
 * On-demand ranked pile of what needs the owner now. Distinct from `brief_me`
 * (day-ahead summary) and from push notices.
 */
export function triageCapabilities(deps: TriageCapabilityDeps): Capability[] {
  const triage: Capability<Record<string, never>> = {
    name: 'triage',
    description:
      'List what needs attention right now: meetings soon, bare agendas, disk space, Downloads clutter',
    examples: ['what needs me', 'triage', 'what should I do now', 'what needs me now'],
    params: z.object({}),
    effect: READ_ONLY,
    async plan(): Promise<Proposal> {
      const result = await deps.triage()
      return {
        kind: 'answer',
        summary: result.summary,
        evidence: result.items.map((item) => ({
          text: `${item.title}: ${item.body}`,
          source: `notice:${item.kind}`
        })),
        ...(result.card ? { card: result.card } : {})
      }
    }
  }

  return [triage as Capability]
}
