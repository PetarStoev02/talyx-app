import { z } from 'zod/v4'
import type { CalendarEvent, Capability, Proposal } from '../model/Capability'
import type { Effect } from '../model/Effect'
import type { RecallHit } from '../../search/services/RecallService'
import { clock, dayRange, describeEvent } from './everyday'

export interface FocusDeps {
  now(): Date
  calendarEvents(from: Date, to: Date): Promise<CalendarEvent[]>
  recall(query: string, limit: number): Promise<RecallHit[]>
  /** The same field ⌘⇧Esc and Settings use: an ISO instant, or null when notices are live. */
  pausedUntil(): string | null
  setPausedUntil(iso: string | null): void
}

export type FocusPayload = { meeting: CalendarEvent; until: string; related: string[] }
export type FocusInverse = { pausedUntil: string | null }

export const RELATED_LIMIT = 10

/** Putting the previous pause back restores Talyx exactly as it was. */
const QUIET: Effect = { world: 'mutates', reversible: true, discloses: 'query' }

/**
 * Meeting mode in one action: quiet Talyx until the meeting you are in (or about
 * to walk into) ends, and bring what relates to it.
 */
export function focusCapabilities(deps: FocusDeps): Capability[] {
  const focus: Capability<Record<string, never>> = {
    name: 'focus',
    description:
      'Meeting mode: pause Talyx notices until the current or next meeting ends and list related files and past chats',
    examples: ['focus', 'meeting mode', 'I am going into my meeting', 'focus for my next meeting'],
    params: z.object({}),
    effect: QUIET,
    async plan(): Promise<Proposal> {
      const now = deps.now()
      const meeting = (await deps.calendarEvents(now, dayRange(now, 0)[1]))
        .filter((e) => !e.allDay && Date.parse(e.end) > now.getTime())
        .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0]
      if (!meeting)
        return {
          kind: 'answer',
          summary: 'No more meetings today — nothing to focus on',
          evidence: []
        }

      // A pause already running past the meeting (⌘⇧Esc) is not cut short by it.
      const current = deps.pausedUntil()
      const until =
        current !== null && Date.parse(current) > Date.parse(meeting.end) ? current : meeting.end
      const related = await relatedTo(meeting.title)
      const count = related.length > 0 ? ` · ${related.length} related` : ''
      return {
        kind: 'plan',
        summary: `Focus on “${meeting.title}” until ${clock(new Date(until))}${count}`,
        operations: [
          {
            label: `Quiet until ${clock(new Date(until))} — ${meeting.title}`,
            reason: 'focus',
            payload: { meeting, until, related } satisfies FocusPayload,
            inverse: { pausedUntil: current } satisfies FocusInverse
          }
        ]
      }
    },
    async execute(op) {
      const { meeting, until, related } = op.payload as FocusPayload
      deps.setPausedUntil(until)
      const lines = [`Quiet until ${clock(new Date(until))} · ${describeEvent(meeting)}`]
      if (related.length > 0) lines.push('Related:', ...related.map((r) => `- ${r}`))
      return lines.join('\n')
    },
    async revert(op) {
      deps.setPausedUntil((op.inverse as FocusInverse).pausedUntil)
    }
  }

  /** Context is a bonus: a search that fails must not stop the quiet. */
  async function relatedTo(title: string): Promise<string[]> {
    try {
      // ponytail: the title is the query. Fine for "Design review", noisy for "Sync";
      // attendees or the event notes would make a better query if this misses.
      return (await deps.recall(title, RELATED_LIMIT)).map(describeHit)
    } catch {
      return []
    }
  }

  return [focus as Capability]
}

function describeHit(hit: RecallHit): string {
  return hit.kind === 'file' ? hit.path : `chat: ${hit.title}`
}
