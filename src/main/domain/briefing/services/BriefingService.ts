import type { ResultCard } from '../../instruction/model/Capability'
import { dayStamp, type Notice } from '../model/Notice'
import type { ReadCapability } from './readCapability'

export interface BriefingDeps {
  read: ReadCapability
  now(): Date
}

/** How much of the inbox is worth counting before "a lot" says it just as well. */
const MAIL_LIMIT = 10

/**
 * What a morning briefing asks, in the order it reads out. Each line is one
 * existing ability, so the briefing can never drift from the answer the owner
 * gets by asking the same question themselves.
 *
 * A headline line gets a card and a place in the notification body; the rest
 * only reach the transcript, so the body stays readable in Notification Centre.
 */
const LINES: { capability: string; params: unknown; headline: boolean }[] = [
  { capability: 'today', params: { day: 'today' }, headline: true },
  { capability: 'unread_mail', params: { limit: MAIL_LIMIT }, headline: true },
  { capability: 'disk_space', params: {}, headline: true },
  { capability: 'what_did_i_do', params: { window: 'yesterday' }, headline: false }
]

/**
 * Assembles the morning briefing out of read-only capability results. No model
 * turn: it costs the owner nothing, works with no Claude connected, and cannot
 * invent a meeting. Prose is a separate setting that runs the ordinary agent
 * loop over `brief_me` instead.
 */
export class BriefingService {
  constructor(private readonly deps: BriefingDeps) {}

  async compose(): Promise<Notice | null> {
    const answers = await this.gather()
    if (answers.length === 0) return null

    return {
      kind: 'briefing',
      fingerprint: dayStamp(this.deps.now()),
      title: 'Good morning',
      body: answers
        .filter((a) => a.headline)
        .map((a) => a.summary)
        .join(' · '),
      detail: ['**Good morning.**', '', ...answers.map((a) => `- ${a.summary}`)].join('\n'),
      cards: answers.flatMap((a) => a.cards)
    }
  }

  /**
   * One line at a time, on purpose. `today` and `what_did_i_do` both drive
   * Calendar.app through osascript, and asking it twice at once is how a
   * briefing quietly comes back missing the owner's whole day — seen for real,
   * both scripts timing out together. Nothing here is waiting on a user, so
   * the extra second costs nobody anything.
   */
  private async gather(): Promise<{ summary: string; headline: boolean; cards: ResultCard[] }[]> {
    const lines: { summary: string; headline: boolean; cards: ResultCard[] }[] = []
    for (const line of LINES) {
      const proposal = await this.deps.read(line.capability, line.params)
      // A briefing only ever asks questions, so a plan means the catalogue
      // changed under us and this line is simply skipped.
      if (proposal === null || proposal.kind !== 'answer') continue
      const card = line.headline ? proposal.card : undefined
      lines.push({ summary: proposal.summary, headline: line.headline, cards: card ? [card] : [] })
    }
    return lines
  }
}
